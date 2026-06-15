export { fileToBase64, buildReceiptFileName } from '@e-companies/shared'

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
