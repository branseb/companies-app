import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/config'
import type { CompanyDocument } from '../../models/document'

export const useDocumentsList = (companyId: string) => {
    const [documents, setDocuments] = useState<CompanyDocument[]>([])
    const [loading, setLoading] = useState(true)

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
                    receiptId: d.data().receiptId,
                    ekasaData: d.data().ekasaData ?? undefined,
                })))
                setLoading(false)
            },
            () => setLoading(false),
        )
    }, [companyId])

    return { documents, loading }
}
