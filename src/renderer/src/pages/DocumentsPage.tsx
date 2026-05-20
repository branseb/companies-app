import { useEffect, useRef, useState } from 'react'
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, IconButton, LinearProgress,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material'
import { CloudUpload, Download, Delete, CheckCircle, FolderOpen, DownloadForOffline, OpenInNew, SettingsOutlined } from '@mui/icons-material'
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, doc, updateDoc, deleteDoc, getDocs, setDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useCompany } from '../context/company'

type DocumentType = 'invoice' | 'bank_statement' | 'travel' | 'other'
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
}

const TYPE_LABELS: Record<DocumentType, string> = {
  invoice: 'Faktúra',
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

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
        })))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [companyId])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selType, setSelType] = useState<DocumentType>('other')
  const [downloading, setDl] = useState<string | null>(null)
  const [confirmDelete, setConfirm] = useState<{ docId: string; fileName: string } | null>(null)
  const [confirmDeleteAll, setConfirmAll] = useState(false)
  const [dlAllProgress, setDlAllProg] = useState<{ done: number; total: number } | null>(null)
  const [folder, setFolder] = useState<string>('')

  useEffect(() => {
    window.electron.document.getFolder().then(setFolder)
  }, [])

  async function handleChangeFolder() {
    const selected = await window.electron.document.setFolder()
    if (selected) setFolder(selected)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setProgress(0)
    try {
      const base64 = await fileToBase64(file)

      const chunks: string[] = []
      for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
        chunks.push(base64.slice(i, i + CHUNK_SIZE))
      }

      const docRef = await addDoc(collection(db, 'companies', companyId, 'documents'), {
        fileName: file.name,
        type: selType,
        status: 'uploaded',
        uploadedAt: serverTimestamp(),
        uploadedBy: 'accountant',
        note: '',
        sizeBytes: file.size,
        contentType: file.type,
        totalChunks: chunks.length,
      })

      const chunksCol = collection(db, 'companies', companyId, 'documents', docRef.id, 'chunks')
      for (let i = 0; i < chunks.length; i++) {
        await setDoc(doc(chunksCol, String(i)), { index: i, data: chunks[i] })
        setProgress(Math.round((i + 1) / chunks.length * 100))
      }
    } finally {
      setUploading(false); setProgress(0); e.target.value = ''
    }
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
      await window.electron.document.save(d.fileName, base64, d.type, activeCompany?.name ?? 'Neznáma firma')

      await updateDoc(doc(db, 'companies', companyId, 'documents', d.id), { status: 'downloaded' })
      await Promise.all(snap.docs.map(s => deleteDoc(s.ref)))
    } finally {
      setDl(null)
    }
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
          <Select
            size="small"
            value={selType}
            onChange={e => setSelType(e.target.value as DocumentType)}
            disabled={uploading}
            sx={{ minWidth: 150 }}
          >
            {(Object.keys(TYPE_LABELS) as DocumentType[]).map(t => (
              <MenuItem key={t} value={t}>{TYPE_LABELS[t]}</MenuItem>
            ))}
          </Select>
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            size="small"
          >
            {uploading ? `${progress}%` : 'Nahrať'}
          </Button>
          <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
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

      {uploading && <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />}

      {documents.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Zatiaľ žiadne dokumenty.</Typography>
        </Paper>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Názov súboru</TableCell>
                <TableCell>Typ</TableCell>
                <TableCell>Veľkosť</TableCell>
                <TableCell>Nahral</TableCell>
                <TableCell>Dátum</TableCell>
                <TableCell>Stav</TableCell>
                <TableCell align="right">Akcie</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map(d => (
                <TableRow key={d.id} hover>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.fileName}
                  </TableCell>
                  <TableCell>{TYPE_LABELS[d.type] ?? d.type}</TableCell>
                  <TableCell>{fmtSize(d.sizeBytes)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={d.uploadedBy === 'accountant' ? 'Účtovník' : 'Firma'}
                      color={d.uploadedBy === 'accountant' ? 'primary' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{fmtDate(d.uploadedAt)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={STATUS_LABEL[d.status] ?? d.status} color={STATUS_COLOR[d.status] ?? 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                      <Tooltip title={d.status === 'uploaded' ? 'Stiahnuť' : 'Súbor už bol stiahnutý'}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleDownload(d)}
                            disabled={downloading === d.id || d.status !== 'uploaded'}
                          >
                            {downloading === d.id ? <CircularProgress size={16} /> : <Download fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      {d.status === 'downloaded' && (
                        <Tooltip title="Označiť ako spracované">
                          <IconButton size="small" onClick={() => handleMarkProcessed(d.id)}>
                            <CheckCircle fontSize="small" color="success" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Vymazať">
                        <IconButton
                          size="small"
                          color="error"
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
      )}
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
