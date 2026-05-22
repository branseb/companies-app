import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, IconButton, InputBase, LinearProgress, Menu, MenuItem,
  Paper, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material'
import {
  ArrowDropDown, CloudUpload, Download, Delete, CheckCircle, EditNote, ExpandLess, ExpandMore,
  FolderOpen, DownloadForOffline, InsertDriveFile, OpenInNew, SettingsOutlined,
  StorageOutlined, Visibility, ChevronLeft, ChevronRight, AccountBalance
} from '@mui/icons-material'
import { ImportInvoiceDialog } from '../components/ImportInvoiceDialog'
import { XmlImportDialog } from '../components/bankTransaction/ImportDialogs'
import { BankStatementPdfDialog } from '../components/BankStatementPdfDialog'
import { parseXML } from '../utils/bankTransactionParsers'
import type { BankAccount, ImportRow } from '../models/bankTransaction'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, doc, updateDoc, deleteDoc, getDocs, setDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCompany } from '../context/company'

type DocumentType = 'invoice' | 'invoice_issued' | 'invoice_received' | 'bank_statement' | 'travel' | 'other'
type DocumentStatus = 'uploaded' | 'downloaded' | 'processed'

interface CompanyDocument {
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
}

const TYPE_LABELS: Record<DocumentType, string> = {
  invoice: 'Neurčené',
  invoice_issued: 'Vydaná faktúra',
  invoice_received: 'Prijatá faktúra',
  bank_statement: 'Výpis z účtu',
  travel: 'Cestovné',
  other: 'Ostatné',
}
const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success'> = {
  uploaded: 'warning',
  downloaded: 'default',
  processed: 'success',
}
const STATUS_LABEL: Record<string, string> = {
  uploaded: 'Nahraté',
  downloaded: 'Stiahnuté',
  processed: 'Spracované',
}

const CHUNK_SIZE = 700_000 // ~700 KB base64 chars per Firestore doc (~525 KB binary)

function prettyPrintXml(xml: string): string {
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

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type PickedFile = { file: File; relativePath: string }
interface FolderNode { name: string; files: PickedFile[]; children: Map<string, FolderNode> }

function buildFolderTree(files: PickedFile[]): FolderNode {
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

function FolderTree({ node, depth = 0 }: { node: FolderNode; depth?: number }) {
  const [open, setOpen] = useState(true)
  const indent = depth * 16
  return (
    <Box>
      {node.name && (
        <Stack direction="row" alignItems="center" gap={0.5}
          onClick={() => setOpen(o => !o)}
          sx={{ cursor: 'pointer', pl: `${8 + indent}px`, pr: 1, py: 0.25, '&:hover': { bgcolor: 'action.hover' } }}
        >
          {open ? <ExpandLess fontSize="small" color="action" /> : <ExpandMore fontSize="small" color="action" />}
          <FolderOpen fontSize="small" color="warning" />
          <Typography variant="body2" fontWeight={600}>{node.name}</Typography>
        </Stack>
      )}
      <Collapse in={!node.name || open}>
        {node.files.map((f, i) => (
          <Stack key={i} direction="row" alignItems="center" gap={0.5}
            sx={{ pl: `${8 + indent + (node.name ? 24 : 0)}px`, pr: 2, py: 0.25 }}
          >
            <InsertDriveFile fontSize="small" sx={{ color: 'text.disabled', fontSize: 16 }} />
            <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.file.name}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
              {fmtSize(f.file.size)}
            </Typography>
          </Stack>
        ))}
        {Array.from(node.children.values()).map(child => (
          <FolderTree key={child.name} node={child} depth={depth + (node.name ? 1 : 0)} />
        ))}
      </Collapse>
    </Box>
  )
}

function NoteCell({ docId, note, companyId }: { docId: string; note: string; companyId: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(note)

  useEffect(() => { if (!editing) setValue(note) }, [note, editing])

  function save() {
    setEditing(false)
    if (value !== note)
      updateDoc(doc(db, 'companies', companyId, 'documents', docId), { note: value })
  }

  if (editing) {
    return (
      <InputBase
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(note); setEditing(false) } }}
        autoFocus
        fullWidth
        sx={{ fontSize: '0.875rem', minWidth: 140 }}
        placeholder="Poznámka..."
      />
    )
  }

  return (
    <Box onClick={() => setEditing(true)} sx={{
      display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'text',
      '&:hover .ni': { opacity: 1 }, minWidth: 100
    }}
    >
      <Typography variant="body2" noWrap sx={{ maxWidth: 160, color: note ? 'text.primary' : 'text.disabled' }}>
        {note || '—'}
      </Typography>
      <EditNote className="ni" sx={{ fontSize: 14, opacity: 0, color: 'text.secondary', flexShrink: 0 }} />
    </Box>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}


export function DocumentsPage({ companyId }: { companyId: string }) {
  const { activeCompany } = useCompany()
  const navigate = useNavigate()
  const { configId } = useParams<{ configId: string }>()
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
        })))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [companyId])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const multiInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const uploadBtnRef = useRef<HTMLButtonElement>(null)
  const [uploadMenuOpen, setUploadMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUpSt] = useState('')
  const [progress, setProgress] = useState(0)
  const [folderPreview, setFolderPreview] = useState<PickedFile[] | null>(null)
  const [downloading, setDl] = useState<string | null>(null)
  const [confirmDelete, setConfirm] = useState<{ docId: string; fileName: string } | null>(null)
  const [confirmDeleteAll, setConfirmAll] = useState(false)
  const [dlAllProgress, setDlAllProg] = useState<{ done: number; total: number } | null>(null)
  const [folder, setFolder] = useState<string>('')
  const [previewDoc, setPreviewDoc] = useState<CompanyDocument | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [previewBase64, setPreviewB64] = useState<string | null>(null)
  const [previewPdfPages, setPdfPages] = useState(0)
  const [previewPdfPage, setPdfPage] = useState(1)
  const [previewLoading, setPreviewLd] = useState(false)
  const pdfPreviewData = useMemo(() =>
    previewBase64 ? { data: Uint8Array.from(atob(previewBase64), c => c.charCodeAt(0)) } : null
    , [previewBase64])
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [xmlImport, setXmlImport] = useState<{ rows: ImportRow[]; format: string; accountIban?: string; docId: string } | null>(null)
  const [xmlImportError, setXmlImportError] = useState('')
  const [pdfBankImport, setPdfBankImport] = useState<{ base64: string; fileName: string; docId: string } | null>(null)
  const [importTarget, setImportTarget] = useState<{ base64: string; fileName: string; docType: 'invoice_issued' | 'invoice_received'; docId: string } | null>(null)

  useEffect(() => {
    window.electron.document.getFolder().then(setFolder)
  }, [])

  useEffect(() => {
    if (!configId || !activeCompany?.id) return
    window.api.bankAccount.byCompany(configId, activeCompany.id).then(setBankAccounts).catch(() => { })
  }, [configId, activeCompany?.id])

  async function detectType(fileName: string, mime: string, base64: string): Promise<DocumentType> {
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

  async function handleChangeFolder() {
    const selected = await window.electron.document.setFolder()
    if (selected) setFolder(selected)
  }

  async function uploadFile(file: File) {
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

  async function uploadFiles(files: File[]) {
    setUploading(true); setProgress(0)
    try {
      for (let i = 0; i < files.length; i++) {
        setUpSt(`${i + 1} / ${files.length}`); setProgress(0)
        await uploadFile(files[i])
      }
    } finally { setUploading(false); setProgress(0); setUpSt('') }
  }

  async function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); e.target.value = ''
    if (!files.length) return
    await uploadFiles(files)
  }

  async function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); e.target.value = ''
    if (!files.length) return
    setFolderPreview(files.map(f => ({ file: f, relativePath: (f as any).webkitRelativePath || f.name })))
  }

  async function handleDeleteAllDownloaded() {
    const done = documents.filter(d => d.status !== 'uploaded')
    for (const d of done) await handleDelete(d.id)
  }

  async function handleDownloadAll() {
    const pending = documents.filter(d => d.status === 'uploaded')
    setDlAllProg({ done: 0, total: pending.length })
    for (let i = 0; i < pending.length; i++) {
      await handleDownload(pending[i])
      setDlAllProg({ done: i + 1, total: pending.length })
    }
    setDlAllProg(null)
  }

  async function handleDownload(d: CompanyDocument) {
    setDl(d.id)
    try {
      const chunksCol = collection(db, 'companies', companyId, 'documents', d.id, 'chunks')
      const snap = await getDocs(query(chunksCol, orderBy('index', 'asc')))

      const base64 = snap.docs.map(s => s.data().data as string).join('')

      let finalType = d.type
      if (d.type === 'invoice') {
        const detected = await detectType(d.fileName, d.contentType ?? '', base64)
        if (detected === 'invoice') return  // nedá sa určiť typ — preskočiť
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
      setDl(null)
    }
  }

  async function handlePreview(d: CompanyDocument) {
    setPreviewDoc(d); setPreviewLd(true); setPreviewUrl(null); setPreviewText(null); setPreviewB64(null); setPdfPage(1)
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
        setPreviewB64(base64)
      } else if (isXml) {
        const arr = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        setPreviewText(prettyPrintXml(new TextDecoder().decode(arr)))
      } else {
        const arr = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        setPreviewUrl(URL.createObjectURL(new Blob([arr], { type: mime })))
      }
    } finally {
      setPreviewLd(false)
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewDoc(null); setPreviewUrl(null); setPreviewText(null); setPreviewB64(null); setReviewQueue([]); setReviewIndex(0)
  }

  function startReview() {
    const queue = documents.filter(d => d.type === 'invoice').map(d => d.id)
    if (!queue.length) return
    setReviewQueue(queue); setReviewIndex(0)
    const first = documents.find(d => d.id === queue[0])
    if (first) handlePreview(first)
  }

  function reviewNav(dir: 1 | -1) {
    const nextIdx = reviewIndex + dir
    if (nextIdx < 0 || nextIdx >= reviewQueue.length) return
    const next = documents.find(d => d.id === reviewQueue[nextIdx])
    if (!next) return
    setReviewIndex(nextIdx)
    handlePreview(next)
  }

  async function handleBankXmlImport(d: CompanyDocument) {
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

  async function handleReclassify(docId: string, newType: DocumentType) {
    await updateDoc(doc(db, 'companies', companyId, 'documents', docId), { type: newType })
  }

  async function handleMarkProcessed(docId: string) {
    await updateDoc(doc(db, 'companies', companyId, 'documents', docId), { status: 'processed' })
  }

  async function handleDelete(docId: string) {
    const chunksCol = collection(db, 'companies', companyId, 'documents', docId, 'chunks')
    const snap = await getDocs(chunksCol)
    await Promise.all(snap.docs.map(s => deleteDoc(s.ref)))
    await deleteDoc(doc(db, 'companies', companyId, 'documents', docId))
  }

  if (loading) {
    return <Box display="flex" alignItems="center" justifyContent="center" flex={1}><CircularProgress /></Box>
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="h6" fontWeight={700}>Dokumenty firmy</Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <Button variant="contained" startIcon={<CloudUpload />} endIcon={<ArrowDropDown />}
            size="small" ref={uploadBtnRef} disabled={uploading} onClick={() => setUploadMenu(true)}
          >
            {uploading && uploadStatus ? uploadStatus : uploading ? `${progress}%` : 'Nahrať'}
          </Button>
          <Menu anchorEl={uploadBtnRef.current} open={uploadMenuOpen} onClose={() => setUploadMenu(false)}>
            <MenuItem onClick={() => { setUploadMenu(false); fileInputRef.current?.click() }}>Jeden súbor</MenuItem>
            <MenuItem onClick={() => { setUploadMenu(false); multiInputRef.current?.click() }}>Viacero súborov</MenuItem>
            <MenuItem onClick={() => { setUploadMenu(false); folderInputRef.current?.click() }}>Priečinok (vrátane podpriečinkov)</MenuItem>
          </Menu>
          <input ref={fileInputRef} type="file" hidden onChange={handleFilesChange} />
          <input ref={multiInputRef} type="file" hidden multiple onChange={handleFilesChange} />
          <input ref={folderInputRef} type="file" hidden {...({ webkitdirectory: '' } as any)} onChange={handleFolderChange} />
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" gap={1} alignItems="center">
          <Tooltip title={`Priečinok sťahovania: ${folder}`}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SettingsOutlined fontSize="small" />}
              onClick={handleChangeFolder}
              sx={{ color: 'text.secondary', textTransform: 'none' }}
            >
              {folder ? folder.split(/[\\/]/).pop() : '…'}
            </Button>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNew fontSize="small" />}
            onClick={() => window.electron.document.openCompanyFolder(activeCompany?.name ?? 'Neznáma firma')}
            sx={{ textTransform: 'none' }}
          >
            {activeCompany?.name ?? 'Priečinok firmy'}
          </Button>
        </Stack>
        <Stack direction="row" gap={1} alignItems="center">
          {documents.some(d => d.status === 'uploaded') && (
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={dlAllProgress ? <CircularProgress size={14} color="inherit" /> : <DownloadForOffline />}
              onClick={handleDownloadAll}
              disabled={!!dlAllProgress}
            >
              {dlAllProgress ? `${dlAllProgress.done}/${dlAllProgress.total}` : 'Stiahnuť všetky'}
            </Button>
          )}

          {documents.some(d => d.status !== 'uploaded') && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={() => setConfirmAll(true)}
            >
              Zmazať stiahnuté
            </Button>
          )}
        </Stack>
      </Stack>

      {uploading && (
        <Stack mb={2} gap={0.5}>
          {uploadStatus && <Typography variant="caption" color="text.secondary">Nahrávam {uploadStatus}</Typography>}
          <LinearProgress variant="determinate" value={progress} />
        </Stack>
      )}

      {documents.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Zatiaľ žiadne dokumenty.</Typography>
        </Paper>
      )}

      {/* ── Neurčené dokumenty ── */}
      {documents.some(d => d.type === 'invoice') && (
        <Paper sx={{ mb: 3, border: 1, borderColor: 'warning.main' }}>
          <Stack direction="row" alignItems="center" gap={1} px={2} py={1}
            sx={{ bgcolor: 'warning.main', borderRadius: '3px 3px 0 0' }}
          >
            <Typography variant="subtitle2" fontWeight={700} color="warning.contrastText">
              Neurčené dokumenty — čakajú na zaradenie ({documents.filter(d => d.type === 'invoice').length})
            </Typography>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Názov súboru</TableCell>
                <TableCell>Veľkosť</TableCell>
                <TableCell>Nahral</TableCell>
                <TableCell>Dátum</TableCell>
                <TableCell>Zaradiť ako</TableCell>
                <TableCell align="right">Akcie</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.filter(d => d.type === 'invoice').map(d => (
                <TableRow key={d.id} hover>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.fileName}
                  </TableCell>
                  <TableCell>{fmtSize(d.sizeBytes)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={d.uploadedBy === 'accountant' ? 'Účtovník' : 'Firma'}
                      color={d.uploadedBy === 'accountant' ? 'primary' : 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell>{fmtDate(d.uploadedAt)}</TableCell>
                  <TableCell>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {(Object.keys(TYPE_LABELS) as DocumentType[]).filter(t => t !== 'invoice').map(t => (
                        <Button key={t} size="small" variant="outlined"
                          onClick={() => handleReclassify(d.id, t)}
                          sx={{ textTransform: 'none', py: 0, fontSize: '0.75rem' }}
                        >
                          {TYPE_LABELS[t]}
                        </Button>
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                      {d.status === 'uploaded' && (
                        <Tooltip title="Náhľad">
                          <IconButton size="small" onClick={() => handlePreview(d)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Vymazať">
                        <IconButton size="small" color="error"
                          onClick={() => setConfirm({ docId: d.id, fileName: d.fileName })}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ── Zaradené dokumenty ── */}
      {(['company', 'accountant'] as const).map(by => {
        const rows = documents.filter(d => d.type !== 'invoice' && d.uploadedBy === by)
        if (!rows.length) return null
        return (
          <Paper key={by} sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary"
              sx={{ display: 'block', px: 2, pt: 1.5, pb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}
            >
              {by === 'company' ? 'Od firmy' : 'Od účtovníka'}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Názov súboru</TableCell>
                  <TableCell>Typ</TableCell>
                  <TableCell>Veľkosť</TableCell>
                  <TableCell>Dátum</TableCell>
                  <TableCell>Stav</TableCell>
                  <TableCell>Poznámka</TableCell>
                  <TableCell align="right">Akcie</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(d => (
                  <TableRow key={d.id} hover>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.fileName}
                    </TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <Tooltip title={d.invoiceId ? 'Typ nie je možné zmeniť — dokument je v databáze' : ''}>
                        <Select size="small" variant="standard" disableUnderline
                          value={d.type}
                          onChange={e => handleReclassify(d.id, e.target.value as DocumentType)}
                          disabled={!!d.invoiceId}
                          sx={{ fontSize: '0.875rem' }}
                        >
                          {(Object.keys(TYPE_LABELS) as DocumentType[]).filter(t => t !== 'invoice').map(t => (
                            <MenuItem key={t} value={t}>{TYPE_LABELS[t]}</MenuItem>
                          ))}
                        </Select>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{fmtSize(d.sizeBytes)}</TableCell>
                    <TableCell>{fmtDate(d.uploadedAt)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={STATUS_LABEL[d.status] ?? d.status} color={STATUS_COLOR[d.status] ?? 'default'} />
                    </TableCell>
                    <TableCell>
                      <NoteCell docId={d.id} note={d.note ?? ''} companyId={companyId} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                        {(d.status === 'uploaded' || d.filePath) && (
                          <Tooltip title="Náhľad">
                            <IconButton size="small" onClick={() => handlePreview(d)}>
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={d.status !== 'uploaded' ? 'Súbor už bol stiahnutý' : 'Stiahnuť'}>
                          <span>
                            <IconButton size="small" onClick={() => handleDownload(d)}
                              disabled={downloading === d.id || d.status !== 'uploaded'}
                            >
                              {downloading === d.id ? <CircularProgress size={16} /> : <Download fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        {d.type === 'bank_statement' && (d.contentType?.includes('xml') || d.fileName.toLowerCase().endsWith('.xml')) && (
                          <Tooltip title="Importovať do bankových transakcií (XML)">
                            <IconButton size="small" color="primary" onClick={() => handleBankXmlImport(d)}>
                              <AccountBalance fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {d.type === 'bank_statement' && (d.contentType === 'application/pdf' || d.fileName.toLowerCase().endsWith('.pdf')) && (
                          <Tooltip title="Importovať do bankových transakcií (PDF)">
                            <IconButton size="small" color="primary" onClick={async () => {
                              const base64 = d.filePath
                                ? await window.electron.document.readFile(d.filePath)
                                : await (async () => {
                                  const chunksCol = collection(db, 'companies', companyId, 'documents', d.id, 'chunks')
                                  const snap = await getDocs(query(chunksCol, orderBy('index', 'asc')))
                                  return snap.docs.map(s => s.data().data as string).join('')
                                })()
                              setPdfBankImport({ base64, fileName: d.fileName, docId: d.id })
                            }}>
                              <AccountBalance fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {d.status === 'downloaded' && d.type.startsWith('invoice') && d.filePath && !d.invoiceId && (
                          <Tooltip title="Importovať do databázy">
                            <IconButton size="small" color="primary"
                              onClick={async () => {
                                const base64 = await window.electron.document.readFile(d.filePath!)
                                setImportTarget({ base64, fileName: d.fileName, docType: d.type as 'invoice_issued' | 'invoice_received', docId: d.id })
                              }}
                            >
                              <StorageOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {d.invoiceId && (
                          <Tooltip title="Zobraziť faktúru v databáze">
                            <IconButton size="small" color="success"
                              onClick={() => {
                                const route = d.type === 'invoice_issued' ? 'issued' : 'received'
                                navigate(`/${configId}/invoices/${route}`, { state: { highlightId: d.invoiceId } })
                              }}
                            >
                              <OpenInNew fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {d.status === 'downloaded' && (
                          <Tooltip title="Označiť ako spracované">
                            <IconButton size="small" onClick={() => handleMarkProcessed(d.id)}>
                              <CheckCircle fontSize="small" color="success" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Vymazať">
                          <IconButton size="small" color="error"
                            onClick={() => d.status === 'uploaded'
                              ? setConfirm({ docId: d.id, fileName: d.fileName })
                              : handleDelete(d.id)
                            }
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )
      })}
      <Dialog open={!!previewDoc} onClose={closePreview} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography variant="inherit" noWrap sx={{ flex: 1 }}>
            {previewDoc?.fileName}
          </Typography>
          <Button size="small" onClick={closePreview}>Zavrieť</Button>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {previewLoading && <CircularProgress />}

          {pdfPreviewData && (
            <Box sx={{
              flex: 1, width: '100%', overflow: 'auto', bgcolor: 'grey.100', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2,
              '&::-webkit-scrollbar': { width: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.400', borderRadius: 2 },
            }}>
              <Document file={pdfPreviewData} onLoadSuccess={({ numPages }) => { setPdfPages(numPages); setPdfPage(1) }}
                loading={<Stack alignItems="center" justifyContent="center" height={200}><CircularProgress /></Stack>}
                error={<Typography color="error" p={2}>PDF sa nepodarilo načítať.</Typography>}
              >
                {Array.from({ length: previewPdfPages }, (_, i) => (
                  <Box key={i} sx={{ mb: 1 }}>
                    <Page pageNumber={i + 1} width={700} renderTextLayer={false} renderAnnotationLayer={false} />
                  </Box>
                ))}
              </Document>
            </Box>
          )}

          {previewText && (
            <Box sx={{
              width: '100%', height: '100%', overflow: 'auto', p: 2,
              '&::-webkit-scrollbar': { width: 8, height: 8 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.400', borderRadius: 2 },
            }}>
              <Box component="pre" sx={{ m: 0, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'text.primary' }}>
                {previewText}
              </Box>
            </Box>
          )}
          {previewUrl && previewDoc?.contentType?.startsWith('image/') && (
            <Box component="img" src={previewUrl} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          )}
          {previewUrl && !previewDoc?.contentType?.startsWith('image/') && (
            <Box component="iframe" src={previewUrl} sx={{ width: '100%', height: '100%', border: 'none' }} />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap', gap: 0.5 }}>
          <Tooltip title={previewDoc?.invoiceId ? 'Typ nie je možné zmeniť — dokument je v databáze' : ''}>
            <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ flex: 1 }}>
              {(Object.keys(TYPE_LABELS) as DocumentType[]).map(t => (
                <Button
                  key={t}
                  size="small"
                  variant={previewDoc?.type === t ? 'contained' : 'outlined'}
                  disabled={!!previewDoc?.invoiceId}
                  onClick={() => {
                    if (!previewDoc || previewDoc.type === t) return
                    handleReclassify(previewDoc.id, t)
                    setPreviewDoc(prev => prev ? { ...prev, type: t } : prev)
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  {TYPE_LABELS[t]}
                </Button>
              ))}
            </Stack>
          </Tooltip>
          {reviewQueue.length > 0 && (
            <Stack direction="row" gap={1} alignItems="center" flexShrink={0}>
              <IconButton size="small" onClick={() => reviewNav(-1)} disabled={reviewIndex === 0}>
                <ChevronLeft />
              </IconButton>
              <Typography variant="body2" minWidth={60} textAlign="center">
                {reviewIndex + 1} / {reviewQueue.length}
              </Typography>
              <IconButton size="small" onClick={() => reviewNav(1)} disabled={reviewIndex === reviewQueue.length - 1}>
                <ChevronRight />
              </IconButton>
            </Stack>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDeleteAll} onClose={() => setConfirmAll(false)}>
        <DialogTitle>Zmazať všetky stiahnuté záznamy?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Budú vymazané všetky záznamy so stavom <strong>Stiahnuté</strong> a <strong>Spracované</strong> ({documents.filter(d => d.status !== 'uploaded').length} záznamov).
            Samotné súbory ostanú na disku.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAll(false)}>Zrušiť</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => { handleDeleteAllDownloaded(); setConfirmAll(false) }}
          >
            Zmazať
          </Button>
        </DialogActions>
      </Dialog>

      {importTarget && (
        <ImportInvoiceDialog
          open={!!importTarget}
          base64={importTarget.base64}
          fileName={importTarget.fileName}
          docType={importTarget.docType}
          onClose={() => setImportTarget(null)}
          onImported={async (invoiceId) => {
            if (importTarget.docId) {
              await updateDoc(doc(db, 'companies', companyId, 'documents', importTarget.docId), { invoiceId })
            }
            const route = importTarget.docType === 'invoice_issued' ? 'issued' : 'received'
            setImportTarget(null)
            navigate(`/${configId}/invoices/${route}`, { state: { highlightId: invoiceId } })
          }}
          onGoToDuplicate={() => {
            setImportTarget(null)
            const route = importTarget.docType === 'invoice_issued' ? 'issued' : 'received'
            navigate(`/${configId}/invoices/${route}`)
          }}
        />
      )}

      <Dialog open={!!folderPreview} onClose={() => setFolderPreview(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Nahrať priečinok —{' '}
          <Typography component="span" variant="inherit" color="text.secondary">
            {folderPreview?.length ?? 0} súborov
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{
          p: 0, maxHeight: 450, overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.400', borderRadius: 2 },
        }}>
          {folderPreview && <FolderTree node={buildFolderTree(folderPreview)} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderPreview(null)}>Zrušiť</Button>
          <Button variant="contained" startIcon={<CloudUpload />}
            onClick={() => { const f = folderPreview!; setFolderPreview(null); uploadFiles(f.map(p => p.file)) }}
          >
            Nahrať {folderPreview?.length ?? 0} súborov
          </Button>
        </DialogActions>
      </Dialog>

      {pdfBankImport && (
        <BankStatementPdfDialog
          open={!!pdfBankImport}
          base64={pdfBankImport.base64}
          fileName={pdfBankImport.fileName}
          accounts={bankAccounts}
          onClose={() => setPdfBankImport(null)}
          onImport={async (rows, bankAccountId) => {
            if (!configId || !activeCompany?.id) return
            await window.api.bankTransaction.bulkImport(configId, rows, activeCompany.id, bankAccountId)
            await updateDoc(doc(db, 'companies', companyId, 'documents', pdfBankImport.docId), { status: 'processed' })
            setPdfBankImport(null)
            navigate(`/${configId}/bank`)
          }}
        />
      )}

      {xmlImport && (
        <XmlImportDialog
          open={!!xmlImport}
          rows={xmlImport.rows}
          format={xmlImport.format}
          accountIban={xmlImport.accountIban}
          accounts={bankAccounts}
          onClose={() => setXmlImport(null)}
          onImport={async (rows, bankAccountId) => {
            if (!configId || !activeCompany?.id) return
            await window.api.bankTransaction.bulkImport(configId, rows, activeCompany.id, bankAccountId)
            await updateDoc(doc(db, 'companies', companyId, 'documents', xmlImport.docId), { status: 'processed' })
            setXmlImport(null)
            navigate(`/${configId}/bank`)
          }}
        />
      )}

      <Dialog open={!!xmlImportError} onClose={() => setXmlImportError('')}>
        <DialogTitle>Chyba pri parsovaní XML</DialogTitle>
        <DialogContent><DialogContentText>{xmlImportError}</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setXmlImportError('')}>OK</Button></DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirm(null)}>
        <DialogTitle>Vymazať nestiahnutý súbor?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Súbor <strong>{confirmDelete?.fileName}</strong> ešte nebol stiahnutý.
            Po vymazaní bude nenávratne stratený.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Zrušiť</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => { handleDelete(confirmDelete!.docId); setConfirm(null) }}
          >
            Vymazať
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
