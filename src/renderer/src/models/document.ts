export type DocumentType = 'invoice' | 'invoice_issued' | 'invoice_received' | 'bank_statement' | 'travel' | 'receipt' | 'other'
export type DocumentStatus = 'uploaded' | 'downloaded' | 'processed'

export type CompanyDocument = {
    id: string
    fileName: string
    type: DocumentType
    status: DocumentStatus
    uploadedAt: Date
    uploadedBy: 'company' | 'accountant'
    note?: string
    sizeBytes: number
    contentType?: string
    totalChunks: number
    filePath?: string
    invoiceId?: number
    receiptId?: number
    ekasaData?: Record<string, unknown>
}

export const TYPE_LABELS: Record<DocumentType, string> = {
    invoice: 'Neurčené',
    invoice_issued: 'Vydaná faktúra',
    invoice_received: 'Prijatá faktúra',
    bank_statement: 'Výpis z účtu',
    travel: 'Cestovné',
    receipt: 'Blok',
    other: 'Ostatné',
}

export const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success'> = {
    uploaded: 'warning',
    downloaded: 'default',
    processed: 'success',
}

export const STATUS_LABEL: Record<string, string> = {
    uploaded: 'Nahraté',
    downloaded: 'Stiahnuté',
    processed: 'Spracované',
}

export const CHUNK_SIZE = 700_000
