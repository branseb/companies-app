import { useEffect, useRef, useState } from 'react'
import {
  Box, Button, Chip, CircularProgress, IconButton, LinearProgress,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material'
import { CloudUpload, Download, Delete, CheckCircle } from '@mui/icons-material'
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, doc, updateDoc, deleteDoc,
} from 'firebase/firestore'
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'firebase/storage'
import { db, storage } from '../firebase/config'

type DocumentType   = 'invoice' | 'bank_statement' | 'travel' | 'other'
type DocumentStatus = 'uploaded' | 'downloaded' | 'processed'

interface CompanyDocument {
  id:          string
  fileName:    string
  storagePath: string
  type:        DocumentType
  status:      DocumentStatus
  uploadedAt:  Date
  uploadedBy:  'company' | 'accountant'
  note?:       string
  sizeBytes:   number
  contentType?: string
}

const TYPE_LABELS: Record<DocumentType, string> = {
  invoice:       'Faktúra',
  bank_statement:'Výpis z účtu',
  travel:        'Cestovné',
  other:         'Ostatné',
}
const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success'> = {
  uploaded:  'warning',
  downloaded:'default',
  processed: 'success',
}
const STATUS_LABEL: Record<string, string> = {
  uploaded:  'Nahraté',
  downloaded:'Stiahnuté',
  processed: 'Spracované',
}

function fmtSize(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function DocumentsPage({ companyId }: { companyId: string }) {
  const [documents, setDocuments] = useState<CompanyDocument[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!companyId) return
    const q = query(
      collection(db, 'companies', companyId, 'documents'),
      orderBy('uploadedAt', 'desc'),
    )
    return onSnapshot(q,
      snap => {
        setDocuments(snap.docs.map(d => ({
          id:          d.id,
          fileName:    d.data().fileName,
          storagePath: d.data().storagePath,
          type:        d.data().type,
          status:      d.data().status,
          uploadedAt:  d.data().uploadedAt?.toDate() ?? new Date(),
          uploadedBy:  d.data().uploadedBy,
          note:        d.data().note,
          sizeBytes:   d.data().sizeBytes,
          contentType: d.data().contentType,
        })))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [companyId])

  const fileInputRef              = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [selType, setSelType]     = useState<DocumentType>('other')
  const [downloading, setDl]      = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setProgress(0)
    try {
      const docRef = await addDoc(collection(db, 'companies', companyId, 'documents'), {
        fileName:    file.name,
        storagePath: '',
        type:        selType,
        status:      'uploaded',
        uploadedAt:  serverTimestamp(),
        uploadedBy:  'accountant',
        note:        '',
        sizeBytes:   file.size,
        contentType: file.type,
      })
      const path = `companies/${companyId}/documents/${docRef.id}_${file.name}`
      const task = uploadBytesResumable(ref(storage, path), file)
      await new Promise<void>((res, rej) => {
        task.on('state_changed', s => setProgress(Math.round(s.bytesTransferred / s.totalBytes * 100)), rej, res)
      })
      await updateDoc(docRef, { storagePath: path })
    } finally {
      setUploading(false); setProgress(0); e.target.value = ''
    }
  }

  async function handleDownload(docId: string, storagePath: string, fileName: string) {
    setDl(docId)
    try {
      const url = await getDownloadURL(ref(storage, storagePath))
      await updateDoc(doc(db, 'companies', companyId, 'documents', docId), { status: 'downloaded' })
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.target = '_blank'; a.click()
    } finally {
      setDl(null)
    }
  }

  async function handleMarkProcessed(docId: string) {
    await updateDoc(doc(db, 'companies', companyId, 'documents', docId), { status: 'processed' })
  }

  async function handleDelete(docId: string, storagePath: string) {
    if (storagePath) await deleteObject(ref(storage, storagePath)).catch(() => {})
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
                      <Tooltip title="Stiahnuť">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleDownload(d.id, d.storagePath, d.fileName)}
                            disabled={downloading === d.id || !d.storagePath}
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
                        <IconButton size="small" onClick={() => handleDelete(d.id, d.storagePath)} color="error">
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
