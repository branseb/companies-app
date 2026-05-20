import { useEffect, useRef, useState } from 'react'
import {
  Box, Button, Chip, CircularProgress, IconButton, LinearProgress,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material'
import { CloudUpload, Download, Delete, CheckCircle } from '@mui/icons-material'
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, doc, updateDoc, deleteDoc, getDocs, setDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

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

function base64ToBlob(base64: string, contentType: string): Blob {
  const byteChars = atob(base64)
  const byteArrays: BlobPart[] = []
  for (let i = 0; i < byteChars.length; i += 1024) {
    const slice = byteChars.slice(i, i + 1024)
    byteArrays.push(new Uint8Array(Array.from(slice).map(c => c.charCodeAt(0))))
  }
  return new Blob(byteArrays, { type: contentType || 'application/octet-stream' })
}

export function DocumentsPage({ companyId }: { companyId: string }) {
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

  async function handleDownload(d: CompanyDocument) {
    setDl(d.id)
    try {
      const chunksCol = collection(db, 'companies', companyId, 'documents', d.id, 'chunks')
      const snap = await getDocs(query(chunksCol, orderBy('index', 'asc')))

      const base64 = snap.docs.map(s => s.data().data as string).join('')
      const blob = base64ToBlob(base64, d.contentType ?? '')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = d.fileName; a.click()
      URL.revokeObjectURL(url)

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
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
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
                      {d.status !== 'processed' && (
                        <Tooltip title="Označiť ako spracované">
                          <IconButton size="small" onClick={() => handleMarkProcessed(d.id)}>
                            <CheckCircle fontSize="small" color="success" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Vymazať">
                        <IconButton size="small" onClick={() => handleDelete(d.id)} color="error">
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
    </Box>
  )
}
