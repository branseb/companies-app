import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    collection, addDoc, onSnapshot, orderBy, query,
    serverTimestamp, doc, updateDoc, deleteDoc, getDocs, setDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCompany } from '../context/company'
import type { CompanyDocument, DocumentType } from '../models/document'
import { CHUNK_SIZE } from '../models/document'
import type { BankAccount, ImportRow } from '../models/bankTransaction'
import { parseXML } from '../utils/bankTransactionParsers'
import { buildFolderTree, fileToBase64, prettyPrintXml, type PickedFile } from '../utils/documentUtils'

export const useDocuments = (companyId: string) => {
    const { activeCompany } = useCompany()
    const navigate = useNavigate()
    const { configId } = useParams<{ configId: string }>()

    const [documents, setDocuments] = useState<CompanyDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState('')
    const [progress, setProgress] = useState(0)
    const [folderPreview, setFolderPreview] = useState<PickedFile[] | null>(null)
    const [downloading, setDownloading] = useState<string | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<{ docId: string; fileName: string } | null>(null)
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
    const [dlAllProgress, setDlAllProgress] = useState<{ done: number; total: number } | null>(null)
    const [folder, setFolder] = useState<string>('')
    const [previewDoc, setPreviewDoc] = useState<CompanyDocument | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewText, setPreviewText] = useState<string | null>(null)
    const [previewBase64, setPreviewBase64] = useState<string | null>(null)
    const [previewPdfPages, setPreviewPdfPages] = useState(0)
    const [previewPdfPage, setPreviewPdfPage] = useState(1)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [reviewQueue, setReviewQueue] = useState<string[]>([])
    const [reviewIndex, setReviewIndex] = useState(0)
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
    const [xmlImport, setXmlImport] = useState<{ rows: ImportRow[]; format: string; accountIban?: string; docId: string } | null>(null)
    const [xmlImportError, setXmlImportError] = useState('')
    const [pdfBankImport, setPdfBankImport] = useState<{ base64: string; fileName: string; docId: string } | null>(null)
    const [importTarget, setImportTarget] = useState<{ base64: string; fileName: string; docType: 'invoice_issued' | 'invoice_received'; docId: string } | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const multiInputRef = useRef<HTMLInputElement>(null)
    const folderInputRef = useRef<HTMLInputElement>(null)
    const uploadBtnRef = useRef<HTMLButtonElement>(null)
    const [uploadMenuOpen, setUploadMenuOpen] = useState(false)

    const pdfPreviewData = useMemo(() =>
        previewBase64 ? { data: Uint8Array.from(atob(previewBase64), c => c.charCodeAt(0)) } : null
        , [previewBase64])

    useEffect(() => {
        if (!companyId) return
        const q = query(
            collection(db, 'companies', companyId, 'documents'),
            orderBy('uploadedAt', 'desc'),
        )
        return onSnapshot(q,
            snap => {
                setDocuments(snap.docs.map(d => ({
                    id: d.id,
                    fileName: d.data().fileName,
                    type: d.data().type,
                    status: d.data().status,
                    uploadedAt: d.data().uploadedAt?.toDate() ?? new Date(),
                    uploadedBy: d.data().uploadedBy,
                    note: d.data().note,
                    sizeBytes: d.data().sizeBytes,
                    contentType: d.data().contentType,
                    totalChunks: d.data().totalChunks ?? 0,
                    filePath: d.data().filePath,
                    invoiceId: d.data().invoiceId,
                })))
                setLoading(false)
            },
            () => setLoading(false),
        )
    }, [companyId])

    useEffect(() => {
        window.electron.document.getFolder().then(setFolder)
    }, [])

    useEffect(() => {
        if (!configId || !activeCompany?.id) return
        window.api.bankAccount.byCompany(configId, activeCompany.id).then(setBankAccounts).catch(() => { })
    }, [configId, activeCompany?.id])

    const detectType = async (fileName: string, mime: string, base64: string): Promise<DocumentType> => {
        const name = fileName.toLowerCase()
        if (mime.includes('xml') || name.endsWith('.xml')) {
            try {
                const text = new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)))
                if (!('error' in parseXML(text))) return 'bank_statement'
                if (/<Invoice[\s>]/i.test(text) || /isdoc/i.test(text)) {
                    const xmlDoc = new DOMParser().parseFromString(text, 'application/xml')
                    const supplierIco = xmlDoc.querySelector('AccountingSupplierParty ID')?.textContent?.trim()
                    return supplierIco && supplierIco === activeCompany?.ico ? 'invoice_issued' : 'invoice_received'
                }
            } catch { }
            return 'other'
        }
        if (mime === 'application/pdf' || name.endsWith('.pdf')) {
            try {
                const p = await window.electron.document.parseInvoice(base64)
                if (p.supplierIco) {
                    return p.supplierIco === activeCompany?.ico ? 'invoice_issued' : 'invoice_received'
                }
            } catch { }
        }
        if (/vydana|issued/.test(name)) return 'invoice_issued'
        if (/faktur|invoice|fa[-_]/.test(name)) return 'invoice_received'
        if (/vypis|statement|camt|fio|tatra|banka/.test(name)) return 'bank_statement'
        if (/cestovn|travel|dieta/.test(name)) return 'travel'
        return 'invoice'
    }

    const handleChangeFolder = async () => {
        const selected = await window.electron.document.setFolder()
        if (selected) setFolder(selected)
    }

    const uploadFile = async (file: File) => {
        const base64 = await fileToBase64(file)
        const type = await detectType(file.name, file.type, base64)
        const chunks: string[] = []
        for (let i = 0; i < base64.length; i += CHUNK_SIZE) chunks.push(base64.slice(i, i + CHUNK_SIZE))
        const docRef = await addDoc(collection(db, 'companies', companyId, 'documents'), {
            fileName: file.name, type, status: 'uploaded',
            uploadedAt: serverTimestamp(), uploadedBy: 'accountant',
            note: '', sizeBytes: file.size, contentType: file.type, totalChunks: chunks.length,
        })
        const chunksCol = collection(db, 'companies', companyId, 'documents', docRef.id, 'chunks')
        for (let i = 0; i < chunks.length; i++) {
            await setDoc(doc(chunksCol, String(i)), { index: i, data: chunks[i] })
            setProgress(Math.round((i + 1) / chunks.length * 100))
        }
    }

    const uploadFiles = async (files: File[]) => {
        setUploading(true); setProgress(0)
        try {
            for (let i = 0; i < files.length; i++) {
                setUploadStatus(`${i + 1} / ${files.length}`); setProgress(0)
                await uploadFile(files[i])
            }
        } finally { setUploading(false); setProgress(0); setUploadStatus('') }
    }

    const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []); e.target.value = ''
        if (!files.length) return
        await uploadFiles(files)
    }

    const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []); e.target.value = ''
        if (!files.length) return
        setFolderPreview(files.map(f => ({ file: f, relativePath: (f as any).webkitRelativePath || f.name })))
    }

    const handleDelete = async (docId: string) => {
        const chunksCol = collection(db, 'companies', companyId, 'documents', docId, 'chunks')
        const snap = await getDocs(chunksCol)
        await Promise.all(snap.docs.map(s => deleteDoc(s.ref)))
        await deleteDoc(doc(db, 'companies', companyId, 'documents', docId))
    }

    const handleDeleteAllDownloaded = async () => {
        const done = documents.filter(d => d.status !== 'uploaded')
        for (const d of done) await handleDelete(d.id)
    }

    const handleDownload = async (d: CompanyDocument) => {
        setDownloading(d.id)
        try {
            const chunksCol = collection(db, 'companies', companyId, 'documents', d.id, 'chunks')
            const snap = await getDocs(query(chunksCol, orderBy('index', 'asc')))
            const base64 = snap.docs.map(s => s.data().data as string).join('')
            let finalType = d.type
            if (d.type === 'invoice') {
                const detected = await detectType(d.fileName, d.contentType ?? '', base64)
                if (detected === 'invoice') return
                finalType = detected
                await updateDoc(doc(db, 'companies', companyId, 'documents', d.id), { type: finalType })
            }
            const savedPath = await window.electron.document.save(d.fileName, base64, finalType, activeCompany?.name ?? 'Neznáma firma')
            await updateDoc(doc(db, 'companies', companyId, 'documents', d.id), {
                status: 'downloaded',
                filePath: savedPath ?? null,
            })
            await Promise.all(snap.docs.map(s => deleteDoc(s.ref)))
        } finally {
            setDownloading(null)
        }
    }

    const handleDownloadAll = async () => {
        const pending = documents.filter(d => d.status === 'uploaded')
        setDlAllProgress({ done: 0, total: pending.length })
        for (let i = 0; i < pending.length; i++) {
            await handleDownload(pending[i])
            setDlAllProgress({ done: i + 1, total: pending.length })
        }
        setDlAllProgress(null)
    }

    const handlePreview = async (d: CompanyDocument) => {
        setPreviewDoc(d); setPreviewLoading(true); setPreviewUrl(null); setPreviewText(null); setPreviewBase64(null); setPreviewPdfPage(1)
        try {
            let base64: string
            if (d.filePath) {
                base64 = await window.electron.document.readFile(d.filePath)
            } else {
                const chunksCol = collection(db, 'companies', companyId, 'documents', d.id, 'chunks')
                const snap = await getDocs(query(chunksCol, orderBy('index', 'asc')))
                base64 = snap.docs.map(s => s.data().data as string).join('')
            }
            const mime = d.contentType || 'application/octet-stream'
            const isPdf = mime === 'application/pdf' || d.fileName.toLowerCase().endsWith('.pdf')
            const isXml = mime.includes('xml') || d.fileName.toLowerCase().endsWith('.xml')
            if (isPdf) {
                setPreviewBase64(base64)
            } else if (isXml) {
                const arr = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
                setPreviewText(prettyPrintXml(new TextDecoder().decode(arr)))
            } else {
                const arr = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
                setPreviewUrl(URL.createObjectURL(new Blob([arr], { type: mime })))
            }
        } finally {
            setPreviewLoading(false)
        }
    }

    const closePreview = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewDoc(null); setPreviewUrl(null); setPreviewText(null); setPreviewBase64(null); setReviewQueue([]); setReviewIndex(0)
    }

    const reviewNav = (dir: 1 | -1) => {
        const nextIdx = reviewIndex + dir
        if (nextIdx < 0 || nextIdx >= reviewQueue.length) return
        const next = documents.find(d => d.id === reviewQueue[nextIdx])
        if (!next) return
        setReviewIndex(nextIdx)
        handlePreview(next)
    }

    const handleBankXmlImport = async (d: CompanyDocument) => {
        setXmlImportError('')
        let base64: string
        if (d.filePath) {
            base64 = await window.electron.document.readFile(d.filePath)
        } else {
            const chunksCol = collection(db, 'companies', companyId, 'documents', d.id, 'chunks')
            const snap = await getDocs(query(chunksCol, orderBy('index', 'asc')))
            base64 = snap.docs.map(s => s.data().data as string).join('')
        }
        const text = new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)))
        const result = parseXML(text)
        if ('error' in result) { setXmlImportError(result.error); return }
        setXmlImport({ ...result, docId: d.id })
    }

    const handleReclassify = async (docId: string, newType: DocumentType) => {
        await updateDoc(doc(db, 'companies', companyId, 'documents', docId), { type: newType })
    }

    const handleMarkProcessed = async (docId: string) => {
        await updateDoc(doc(db, 'companies', companyId, 'documents', docId), { status: 'processed' })
    }

    return {
        documents, loading,
        uploading, uploadStatus, progress, uploadMenuOpen, setUploadMenuOpen,
        folderPreview, setFolderPreview,
        downloading,
        confirmDelete, setConfirmDelete,
        confirmDeleteAll, setConfirmDeleteAll,
        dlAllProgress,
        folder,
        previewDoc, setPreviewDoc, previewUrl, previewText, previewBase64,
        previewPdfPages, setPreviewPdfPages, previewPdfPage, setPreviewPdfPage, previewLoading,
        pdfPreviewData,
        reviewQueue, reviewIndex,
        bankAccounts,
        xmlImport, setXmlImport,
        xmlImportError, setXmlImportError,
        pdfBankImport, setPdfBankImport,
        importTarget, setImportTarget,
        fileInputRef, multiInputRef, folderInputRef, uploadBtnRef,
        navigate, configId,
        handleFilesChange, handleFolderChange, handleChangeFolder,
        uploadFiles,
        handleDownload, handleDownloadAll, handleDeleteAllDownloaded,
        handlePreview, closePreview, reviewNav,
        handleBankXmlImport,
        handleReclassify, handleMarkProcessed, handleDelete,
        buildFolderTree,
    }
}
