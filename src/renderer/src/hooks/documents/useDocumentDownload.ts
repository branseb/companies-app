import { useState } from 'react'
import {
    collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import type { CompanyDocument, DocumentType } from '../../models/document'
import { buildReceiptFileName, decodeQrFromBase64, detectKind, fetchEkasaReceipt } from '../../components/QrScanDialog'

type ActiveCompany = { id?: number | null; name?: string | null; ico?: string | null } | null | undefined
type DetectTypeFn = (fileName: string, mime: string, base64: string) => Promise<DocumentType>

export const useDocumentDownload = (
    companyId: string,
    configId: string | undefined,
    activeCompany: ActiveCompany,
    documents: CompanyDocument[],
    detectType: DetectTypeFn,
) => {
    const [downloading, setDownloading]     = useState<string | null>(null)
    const [dlAllProgress, setDlAllProgress] = useState<{ done: number; total: number } | null>(null)

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

            if (activeCompany?.id && configId) {
                const mime = d.contentType ?? ''
                try {
                    if (d.ekasaData) {
                        const ekasaId = (d.ekasaData.receiptId as string | undefined) ?? ''
                        await window.api.receipt.create(
                            configId, activeCompany.id,
                            ekasaId, JSON.stringify(d.ekasaData),
                            base64, buildReceiptFileName(d.ekasaData, d.fileName, ekasaId),
                        )
                        window.dispatchEvent(new CustomEvent('receipts-changed'))
                    } else if (mime.startsWith('image/')) {
                        const qrText = await decodeQrFromBase64(base64, mime)
                        if (qrText && detectKind(qrText) === 'ekasa') {
                            let ekasaData: Record<string, unknown> = {}
                            try { ekasaData = await fetchEkasaReceipt(qrText.trim()) } catch { }
                            await window.api.receipt.create(
                                configId, activeCompany.id,
                                qrText.trim(), JSON.stringify(ekasaData),
                                base64, buildReceiptFileName(ekasaData, d.fileName, qrText.trim()),
                            )
                            window.dispatchEvent(new CustomEvent('receipts-changed'))
                        }
                    }
                } catch (err) {
                    console.error('[receipt.create] zlyhalo:', err)
                }
            }
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

    return { downloading, dlAllProgress, handleDownload, handleDownloadAll }
}
