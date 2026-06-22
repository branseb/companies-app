import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCompany } from '../context/company'
import type { CompanyDocument, DocumentType } from '../models/document'
import type { BankAccount, ImportRow } from '../models/bankTransaction'
import { parseXML } from '../utils/bankTransactionParsers'
import { buildFolderTree, buildReceiptFileName } from '../utils/documentUtils'
import { decodeQrFromBase64, detectKind, fetchEkasaReceipt } from '../components/QrScanDialog'
import { useDocumentsList }    from './documents/useDocumentsList'
import { useDocumentUpload }   from './documents/useDocumentUpload'
import { useDocumentPreview }  from './documents/useDocumentPreview'
import { useDocumentDownload } from './documents/useDocumentDownload'

export const useDocuments = (companyId: string) => {
    const { activeCompany } = useCompany()
    const navigate = useNavigate()
    const { configId } = useParams<{ configId: string }>()

    const list     = useDocumentsList(companyId)
    const upload   = useDocumentUpload(companyId, activeCompany)
    const preview  = useDocumentPreview(companyId, list.documents)
    const download = useDocumentDownload(companyId, configId, activeCompany, list.documents, upload.detectType)

    const [folder, setFolder] = useState<string>('')
    const [confirmDelete, setConfirmDelete]       = useState<{ docId: string; fileName: string } | null>(null)
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
    const [bankAccounts, setBankAccounts]         = useState<BankAccount[]>([])
    const [xmlImport, setXmlImport]               = useState<{ rows: ImportRow[]; format: string; accountIban?: string; docId: string } | null>(null)
    const [xmlImportError, setXmlImportError]     = useState('')
    const [pdfBankImport, setPdfBankImport]       = useState<{ base64: string; fileName: string; docId: string } | null>(null)
    const [importTarget, setImportTarget]         = useState<{ base64: string; fileName: string; docType: 'invoice_issued' | 'invoice_received'; docId: string } | null>(null)

    useEffect(() => {
        window.electron.document.getFolder().then(setFolder)
    }, [])

    useEffect(() => {
        if (!configId || !activeCompany?.id) return
        window.api.bankAccount.byCompany(configId, activeCompany.id).then(setBankAccounts).catch(() => { })
    }, [configId, activeCompany?.id])

    const handleChangeFolder = async () => {
        const selected = await window.electron.document.setFolder()
        if (selected) setFolder(selected)
    }

    const readDocBase64 = async (d: CompanyDocument): Promise<string> => {
        if (d.filePath) return window.electron.document.readFile(d.filePath)
        const chunksCol = collection(db, 'companies', companyId, 'documents', d.id, 'chunks')
        const snap = await getDocs(query(chunksCol, orderBy('index', 'asc')))
        return snap.docs.map(s => s.data().data as string).join('')
    }

    const handleDelete = async (docId: string) => {
        const chunksCol = collection(db, 'companies', companyId, 'documents', docId, 'chunks')
        const snap = await getDocs(chunksCol)
        await Promise.all(snap.docs.map(s => deleteDoc(s.ref)))
        await deleteDoc(doc(db, 'companies', companyId, 'documents', docId))
    }

    const handleDeleteAllDownloaded = async () => {
        const done = list.documents.filter(d => d.status !== 'uploaded')
        for (const d of done) await handleDelete(d.id)
    }

    const handleBankXmlImport = async (d: CompanyDocument) => {
        setXmlImportError('')
        const base64 = await readDocBase64(d)
        const text = new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)))
        const result = parseXML(text)
        if ('error' in result) { setXmlImportError(result.error); return }
        setXmlImport({ ...result, docId: d.id })
    }

    const handleImportToReceipts = async (d: CompanyDocument): Promise<number | undefined> => {
        if (!activeCompany?.id || !configId) return undefined
        const base64 = await readDocBase64(d)
        let result: any
        if (d.ekasaData) {
            const ekasaId = (d.ekasaData.receiptId as string | undefined) ?? ''
            result = await window.api.receipt.create(
                configId, activeCompany.id,
                ekasaId, JSON.stringify(d.ekasaData),
                base64, buildReceiptFileName(d.ekasaData, d.fileName, ekasaId),
            )
        } else {
            const mime = d.contentType ?? 'image/jpeg'
            const qrText = await decodeQrFromBase64(base64, mime)
            let ekasaData: Record<string, unknown> = {}
            if (qrText && detectKind(qrText) === 'ekasa') {
                try { ekasaData = await fetchEkasaReceipt(qrText.trim()) } catch { }
            }
            const ekasaId = qrText?.trim() ?? ''
            result = await window.api.receipt.create(
                configId, activeCompany.id,
                ekasaId, JSON.stringify(ekasaData),
                base64, buildReceiptFileName(ekasaData, d.fileName, ekasaId),
            )
        }
        const rid = result?.duplicate ? result.id : result?.id
        if (rid) {
            await updateDoc(doc(db, 'companies', companyId, 'documents', d.id), { receiptId: rid })
        }
        window.dispatchEvent(new CustomEvent('receipts-changed'))
        return rid as number | undefined
    }

    const handleReclassify = async (docId: string, newType: DocumentType) => {
        await updateDoc(doc(db, 'companies', companyId, 'documents', docId), { type: newType })
    }

    const handleMarkProcessed = async (docId: string) => {
        await updateDoc(doc(db, 'companies', companyId, 'documents', docId), { status: 'processed' })
    }

    return {
        // list
        ...list,
        // upload
        ...upload,
        // preview
        ...preview,
        // download
        ...download,
        // misc
        folder, handleChangeFolder,
        confirmDelete, setConfirmDelete,
        confirmDeleteAll, setConfirmDeleteAll,
        bankAccounts,
        xmlImport, setXmlImport,
        xmlImportError, setXmlImportError,
        pdfBankImport, setPdfBankImport,
        importTarget, setImportTarget,
        navigate, configId,
        handleDelete, handleDeleteAllDownloaded,
        handleBankXmlImport, handleImportToReceipts,
        handleReclassify, handleMarkProcessed,
        buildFolderTree,
    }
}
