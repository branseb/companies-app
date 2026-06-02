export type PickedFile = { file: File; relativePath: string }
export type FolderNode = { name: string; files: PickedFile[]; children: Map<string, FolderNode> }

export const prettyPrintXml = (xml: string): string => {
    try {
        let indent = 0
        const lines = xml.replace(/>\s*</g, '>\n<').split('\n')
        return lines.map(line => {
            const t = line.trim()
            if (!t) return ''
            if (t.startsWith('</')) indent = Math.max(0, indent - 1)
            const out = '  '.repeat(indent) + t
            if (t.startsWith('<') && !t.startsWith('</') && !t.startsWith('<?') && !t.endsWith('/>') && !t.includes('</')) indent++
            return out
        }).filter(Boolean).join('\n')
    } catch {
        return xml
    }
}

export const fmtSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const fmtDocDate = (d: Date): string =>
    d.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const buildFolderTree = (files: PickedFile[]): FolderNode => {
    const root: FolderNode = { name: '', files: [], children: new Map() }
    for (const f of files) {
        const parts = f.relativePath.split('/')
        let node = root
        for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i]
            if (!node.children.has(p)) node.children.set(p, { name: p, files: [], children: new Map() })
            node = node.children.get(p)!
        }
        node.files.push(f)
    }
    return root
}

export const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
    })

const fmtDateParts = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

export const buildReceiptFileName = (
    ekasaData: Record<string, unknown> | null | undefined,
    fallback: string,
    ekasaId?: string,
): string => {
    const sanitize = (s: string) => s.replace(/[/\\:*?"<>|,]/g, '').replace(/\s+/g, '-').trim()
    const ext = fallback.split('.').pop()?.toLowerCase() ?? 'jpg'
    const org  = ekasaData?.organizationName as string | undefined
    const date = ekasaData?.createDate as string | undefined

    let datePart = ''
    if (date) {
        const m = String(date).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
        datePart = m
            ? `${m[3]}-${m[2]}-${m[1]}-${m[4]}-${m[5]}${m[6] ? `-${m[6]}` : ''}`
            : String(date).replace(/[T\s]/g, '-').replace(/:/g, '-')
    }

    if (org || datePart) {
        const parts = ['blok', org ? sanitize(org) : '', datePart].filter(Boolean)
        return `${parts.join('-')}.${ext}`
    }

    // No org/date — try receiptNumber as identifier
    const num = ekasaData?.receiptNumber as string | undefined
    if (num) return `blok-${sanitize(num)}.${ext}`

    // If ekasaId (QR text) is available, use its short suffix
    if (ekasaId) {
        const suffix = ekasaId.slice(-8)
        return `blok-${fmtDateParts(new Date())}-${suffix}.${ext}`
    }

    // If fallback is a portal-generated timestamp (blok-1234567890.jpg), convert it to a readable date
    const tsMatch = fallback.match(/^blok-(\d{10,13})\.(.+)$/)
    if (tsMatch) {
        return `blok-${fmtDateParts(new Date(Number(tsMatch[1])))}.${tsMatch[2]}`
    }

    return fallback
}
