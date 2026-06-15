import { useRef, useState } from 'react'
import { addDoc, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import type { CompanyDocument, DocumentType } from '../../models/document'
import { CHUNK_SIZE } from '../../models/document'
import { parseXML } from '../../utils/bankTransactionParsers'
import { fileToBase64, type PickedFile } from '../../utils/documentUtils'

type ActiveCompany = { ico?: string | null } | null | undefined

export const useDocumentUpload = (companyId: string, activeCompany: ActiveCompany) => {
    const [uploading, setUploading]       = useState(false)
    const [uploadStatus, setUploadStatus] = useState('')
    const [progress, setProgress]         = useState(0)
    const [folderPreview, setFolderPreview] = useState<PickedFile[] | null>(null)
    const [uploadMenuOpen, setUploadMenuOpen] = useState(false)

    const fileInputRef   = useRef<HTMLInputElement>(null)
    const multiInputRef  = useRef<HTMLInputElement>(null)
    const folderInputRef = useRef<HTMLInputElement>(null)
    const uploadBtnRef   = useRef<HTMLButtonElement>(null)

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

    return {
        uploading, uploadStatus, progress,
        folderPreview, setFolderPreview,
        uploadMenuOpen, setUploadMenuOpen,
        fileInputRef, multiInputRef, folderInputRef, uploadBtnRef,
        detectType, uploadFiles,
        handleFilesChange, handleFolderChange,
    }
}
