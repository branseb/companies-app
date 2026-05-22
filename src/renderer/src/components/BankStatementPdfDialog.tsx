import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Paper, Select, Stack,
  TextField, Tooltip, Typography,
} from '@mui/material'
import { Add, ChevronLeft, ChevronRight, Delete, ZoomIn, ZoomOut, ZoomOutMap } from '@mui/icons-material'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import type { BankAccount, ImportRow } from '../models/bankTransaction'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const scrollbar = {
  '&::-webkit-scrollbar': { width: 8, height: 8 },
  '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.400', borderRadius: 2, border: '2px solid transparent', backgroundClip: 'padding-box' },
}

interface TxRow {
  date: string
  amount: string
  currency: string
  description: string
  variableSymbol: string
  counterpartyName: string
  counterpartyIban: string
}

const emptyRow = (): TxRow => ({
  date: '', amount: '', currency: 'EUR',
  description: '', variableSymbol: '', counterpartyName: '', counterpartyIban: '',
})

function toImportRow(r: TxRow): ImportRow | null {
  const amount = parseFloat(r.amount.replace(',', '.'))
  if (!r.date || isNaN(amount)) return null
  return {
    date: r.date, amount, currency: r.currency || 'EUR',
    description: r.description || undefined,
    variableSymbol: r.variableSymbol || undefined,
    counterpartyName: r.counterpartyName || undefined,
    counterpartyIban: r.counterpartyIban || undefined,
  }
}

interface Props {
  open: boolean
  base64: string
  fileName: string
  accounts: BankAccount[]
  onClose: () => void
  onImport: (rows: ImportRow[], bankAccountId?: number) => Promise<void>
}

export function BankStatementPdfDialog({ open, base64, fileName, accounts, onClose, onImport }: Props) {
  const pdfData = useMemo(() => {
    if (!base64) return null
    return { data: Uint8Array.from(atob(base64), c => c.charCodeAt(0)) }
  }, [base64])

  const [numPages, setNumPages] = useState(0)
  const [pageNum, setPageNum]   = useState(1)
  const [pdfWidth, setPdfWidth] = useState(480)
  const [zoom, setZoom]         = useState(1)
  const ZOOM_STEP = 0.25; const ZOOM_MIN = 0.5; const ZOOM_MAX = 3

  const scrollRef  = useRef<HTMLDivElement>(null)
  const dragOrigin = useRef<{ x: number; y: number; scrollX: number; scrollY: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  function onPanStart(e: React.MouseEvent) {
    if (e.button !== 0) return
    const el = scrollRef.current; if (!el) return
    dragOrigin.current = { x: e.clientX, y: e.clientY, scrollX: el.scrollLeft, scrollY: el.scrollTop }
    setDragging(true); e.preventDefault()
  }
  function onPanMove(e: React.MouseEvent) {
    if (!dragOrigin.current || !scrollRef.current) return
    scrollRef.current.scrollLeft = dragOrigin.current.scrollX - (e.clientX - dragOrigin.current.x)
    scrollRef.current.scrollTop  = dragOrigin.current.scrollY - (e.clientY - dragOrigin.current.y)
  }
  function onPanEnd() { dragOrigin.current = null; setDragging(false) }

  const [rows, setRows]         = useState<TxRow[]>([emptyRow()])
  const [accountId, setAccountId] = useState<number | ''>('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!open) return
    setRows([emptyRow()]); setPageNum(1); setZoom(1); setError('')
    const matched = accounts[0]
    setAccountId(matched?.id ?? '')
  }, [open])

  function updateRow(i: number, field: keyof TxRow, value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function addRow() { setRows(prev => [...prev, emptyRow()]) }
  function removeRow(i: number) { setRows(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)) }

  const validRows = rows.map(toImportRow).filter(Boolean) as ImportRow[]

  async function handleSave() {
    if (!validRows.length) return
    setSaving(true); setError('')
    try {
      await onImport(validRows, accountId || undefined)
    } catch (e: any) {
      setError(e?.message ?? 'Chyba pri importe.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle sx={{ py: 1.5 }}>
        Importovať bankový výpis —{' '}
        <Typography component="span" variant="inherit" color="text.secondary">{fileName}</Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', overflow: 'hidden' }}>

        {/* PDF viewer */}
        <Box sx={{ width: '50%', borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}
          ref={(el: HTMLDivElement | null) => { if (el) setPdfWidth(el.clientWidth - 32) }}
        >
          <Box ref={scrollRef}
            sx={{ flex: 1, overflow: 'auto', bgcolor: 'grey.100', p: 2, cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', ...scrollbar }}
            onMouseDown={onPanStart} onMouseMove={onPanMove} onMouseUp={onPanEnd} onMouseLeave={onPanEnd}
          >
            {pdfData ? (
              <Box sx={{ width: 'fit-content', margin: '0 auto' }}>
                <Document file={pdfData} onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={<Stack alignItems="center" justifyContent="center" height={300}><CircularProgress /></Stack>}
                  error={<Alert severity="error" sx={{ m: 2 }}>PDF sa nepodarilo načítať.</Alert>}
                >
                  <Page pageNumber={pageNum} width={pdfWidth * zoom} renderTextLayer renderAnnotationLayer={false} />
                </Document>
              </Box>
            ) : (
              <Stack alignItems="center" justifyContent="center" height="100%">
                <Typography color="text.secondary">Žiadne PDF</Typography>
              </Stack>
            )}
          </Box>

          <Stack direction="row" alignItems="center" justifyContent="space-between" px={1} py={0.5}
            sx={{ borderTop: 1, borderColor: 'divider', flexShrink: 0 }}
          >
            <Stack direction="row" alignItems="center" gap={0.5}>
              <IconButton size="small" onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum === 1 || numPages === 0}>
                <ChevronLeft fontSize="small" />
              </IconButton>
              <Typography variant="body2" minWidth={60} textAlign="center">
                {numPages > 0 ? `${pageNum} / ${numPages}` : '—'}
              </Typography>
              <IconButton size="small" onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum === numPages || numPages === 0}>
                <ChevronRight fontSize="small" />
              </IconButton>
            </Stack>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <IconButton size="small" onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))} disabled={zoom <= ZOOM_MIN}>
                <ZoomOut fontSize="small" />
              </IconButton>
              <Typography variant="body2" minWidth={44} textAlign="center" sx={{ cursor: 'pointer' }} onClick={() => setZoom(1)}>
                {Math.round(zoom * 100)} %
              </Typography>
              <IconButton size="small" onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))} disabled={zoom >= ZOOM_MAX}>
                <ZoomIn fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => setZoom(1)} title="Reset zoomu">
                <ZoomOutMap fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Box>

        {/* Transaction entry */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2, ...scrollbar }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction="row" alignItems="center" gap={2}>
            <Box>
              <Typography variant="caption" display="block" gutterBottom>Bankový účet</Typography>
              <Select size="small" value={accountId} onChange={e => setAccountId(e.target.value as number | '')}
                displayEmpty sx={{ minWidth: 220 }}
              >
                <MenuItem value=""><em>— bez účtu —</em></MenuItem>
                {accounts.map(a => (
                  <MenuItem key={a.id} value={a.id}>{a.name}{a.iban ? ` (${a.iban})` : ''}</MenuItem>
                ))}
              </Select>
            </Box>
          </Stack>

          <Stack gap={1.5}>
            {rows.map((row, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                <Stack gap={1.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Pohyb {i + 1}
                    </Typography>
                    <Tooltip title="Odstrániť">
                      <span>
                        <IconButton size="small" color="error" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>

                  <Stack direction="row" gap={1.5}>
                    <TextField size="small" label="Dátum *" type="date" value={row.date}
                      onChange={e => updateRow(i, 'date', e.target.value)}
                      InputLabelProps={{ shrink: true }} sx={{ width: 155 }}
                    />
                    <TextField size="small" label="Suma *" value={row.amount} placeholder="-12.50"
                      onChange={e => updateRow(i, 'amount', e.target.value)} sx={{ width: 110 }}
                    />
                    <Select size="small" value={row.currency} onChange={e => updateRow(i, 'currency', e.target.value)}
                      sx={{ width: 90 }}
                    >
                      {['EUR', 'CZK', 'USD', 'GBP'].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                    <TextField size="small" label="VS" value={row.variableSymbol}
                      onChange={e => updateRow(i, 'variableSymbol', e.target.value)} sx={{ width: 110 }}
                    />
                  </Stack>

                  <TextField size="small" label="Popis" value={row.description} fullWidth
                    onChange={e => updateRow(i, 'description', e.target.value)}
                  />

                  <Stack direction="row" gap={1.5}>
                    <TextField size="small" label="Protistrana" value={row.counterpartyName}
                      onChange={e => updateRow(i, 'counterpartyName', e.target.value)} sx={{ flex: 1 }}
                    />
                    <TextField size="small" label="IBAN protistrany" value={row.counterpartyIban}
                      onChange={e => updateRow(i, 'counterpartyIban', e.target.value)} sx={{ flex: 1 }}
                    />
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Button size="small" startIcon={<Add />} onClick={addRow} sx={{ alignSelf: 'flex-start', mt: 0.5 }}>
            Pridať pohyb
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={saving}>Zrušiť</Button>
        <Button variant="contained" onClick={handleSave}
          disabled={saving || validRows.length === 0}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Importovať {validRows.length > 0 ? `${validRows.length} pohybov` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
