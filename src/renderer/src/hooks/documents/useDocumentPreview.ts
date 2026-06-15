import { useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/config'
import type { CompanyDocument } from '../../models/document'
import { prettyPrintXml } from '../../utils/documentUtils'

export const useDocumentPreview = (companyId: string, documents: CompanyDocument[]) => {
    const [previewDoc, setPreviewDoc]         = useState<CompanyDocument | null>(null)
    const [previewUrl, setPreviewUrl]         = useState<string | null>(null)
    const [previewText, setPreviewText]       = useState<string | null>(null)
    const [previewBase64, setPreviewBase64]   = useState<string | null>(null)
    const [previewPdfPages, setPreviewPdfPages] = useState(0)
    const [previewPdfPage, setPreviewPdfPage] = useState(1)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [reviewQueue, setReviewQueue]       = useState<string[]>([])
    const [reviewIndex, setReviewIndex]       = useState(0)

    const pdfPreviewData = useMemo(() =>
        previewBase64 ? { data: Uint8Array.from(atob(previewBase64), c => c.charCodeAt(0)) } : null
    , [previewBase64])

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

    return {
        previewDoc, setPreviewDoc,
        previewUrl, previewText, previewBase64,
        previewPdfPages, setPreviewPdfPages,
        previewPdfPage, setPreviewPdfPage,
        previewLoading, pdfPreviewData,
        reviewQueue, setReviewQueue,
        reviewIndex, setReviewIndex,
        handlePreview, closePreview, reviewNav,
    }
}
