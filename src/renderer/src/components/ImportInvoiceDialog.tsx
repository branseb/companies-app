import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Stack, Tooltip, Typography,
} from '@mui/material'
import { BugReport, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ZoomOutMap } from '@mui/icons-material'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { useCompany } from '../context/company'
import { mapToEN16931 } from '../utils/mapToEN16931'
import { InvoiceFormContent } from './InvoiceFormContent'
import type { SimpleInvoice } from '../models/SimpleInvoice'
import { today, addDays } from '@e-companies/shared'

const scrollbar = {
  '&::-webkit-scrollbar':       { width: 10, height: 10 },
  '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: 'grey.400', borderRadius: 3,
    border: '3px solid transparent', backgroundClip: 'padding-box',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    bgcolor: 'grey.600',
    border: '3px solid transparent', backgroundClip: 'padding-box',
  },
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

type Props = {
  open: boolean
  base64: string
  fileName: string
  docType: 'invoice_issued' | 'invoice_received'
  onClose: () => void
  onImported: (invoiceId: number) => void
  onGoToDuplicate?: () => void
}

const due14 = () => addDays(today(), 14)

export function ImportInvoiceDialog({ open, base64, fileName, docType, onClose, onImported, onGoToDuplicate }: Props) {
  const { activeCompany, activeConfigId } = useCompany()

  const pdfData = useMemo(() => {
    if (!base64) return null
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    return { data: bytes }
  }, [base64])

  const [numPages, setNumPages] = useState(0)
  const [pageNum, setPageNum]   = useState(1)
  const [pdfWidth, setPdfWidth] = useState(500)
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
  function onDoubleClick(e: React.MouseEvent) {
    if (e.ctrlKey) setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))
    else           setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))
  }

  const [invoice, setInvoice]           = useState<SimpleInvoice | null>(null)
  const [vatEnabled, setVatEnabled]     = useState(true)
  const [parsing, setParsing]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [duplicateWarning, setDupWarn]  = useState('')
  const [rawText, setRawText]           = useState('')
  const [showRaw, setShowRaw]           = useState(false)
  const [parseSource, setParseSource]   = useState<'isdoc' | 'regex' | null>(null)

  useEffect(() => {
    if (!open || !base64) return
    setPageNum(1); setZoom(1); setError(''); setDupWarn(''); setShowRaw(false); setParseSource(null)
    setParsing(true)
    const isIssued = docType === 'invoice_issued'
    const ours = {
      name:    activeCompany?.name    || '',
      ico:     activeCompany?.ico     || '',
      dic:     activeCompany?.dic     || '',
      icDph:   activeCompany?.icDph   || '',
      address: activeCompany?.address || '',
      city:    activeCompany?.city    || '',
      zip:     activeCompany?.zip     || '',
      country: activeCompany?.country || 'SK',
    };
    (async () => {
      try {
        const [p, dfId] = await Promise.all([
          window.electron.document.parseInvoice(base64),
          !isIssued && activeConfigId ? window.api.invoice.nextDfId(activeConfigId) : Promise.resolve(''),
        ])
        setRawText(p._rawText ?? '')
        setParseSource(p._source ?? 'regex')
        const net = p.totalAmount - p.vatAmount
        setInvoice({
          invoiceNumber: isIssued ? p.invoiceNumber : dfId,
          issueDate:     p.issueDate  || today(),
          dueDate:       p.dueDate    || due14(),
          delivery:      p.deliveryDate ? { actualDeliveryDate: p.deliveryDate } : undefined,
          currency:      p.currency   || 'EUR',
          supplier: isIssued ? {
            name:    ours.name,
            ico:     ours.ico,
            dic:     ours.dic,
            icDph:   ours.icDph,
            address: p.supplierAddress || ours.address,
            city:    p.supplierCity    || ours.city,
            zip:     p.supplierZip     || ours.zip,
            country: ours.country,
          } : {
            name:    p.supplierName    || '',
            ico:     p.supplierIco     || '',
            dic:     p.supplierDic     || '',
            icDph:   p.supplierIcDph   || '',
            address: p.supplierAddress || '',
            city:    p.supplierCity    || '',
            zip:     p.supplierZip     || '',
            country: 'SK',
          },
          customer: isIssued ? {
            name:    p.customerName    || '',
            ico:     p.customerIco     || '',
            dic:     p.customerDic     || '',
            address: p.customerAddress || '',
            zip:     p.customerZip     || '',
            city:    p.customerCity    || '',
            country: 'SK',
          } : ours,
          items: p.parsedItems?.length ? p.parsedItems : [{
            description: 'Faktúra',
            quantity:    1,
            unitPrice:   net > 0 ? net : p.totalAmount,
            taxRate:     p.taxRate || 20,
          }],
        })

        if (activeConfigId) {
          if (!isIssued && p.supplierIco) {
            const existing = await window.api.invoice.bySupplierIco(activeConfigId, p.supplierIco)
            const dup = existing.find((inv: any) => inv.issueDate === (p.issueDate || today()))
            if (dup) setDupWarn(`Faktúra od tohto dodávateľa s dátumom ${p.issueDate} už existuje v databáze (č. ${dup.invoiceNumber})`)
          } else if (isIssued && p.invoiceNumber && activeCompany?.id) {
            const existing = await window.api.invoice.byCompany(activeConfigId, activeCompany.id)
            const dup = existing.find((inv: any) => inv.invoiceNumber === p.invoiceNumber)
            if (dup) setDupWarn(`Vydaná faktúra č. ${p.invoiceNumber} už existuje v databáze`)
          }
        }
      } catch {
        setError('Nepodarilo sa načítať PDF. Vyplňte polia manuálne.')
        setInvoice({
          invoiceNumber: '', issueDate: today(), dueDate: due14(), currency: 'EUR',
          supplier: isIssued ? ours : { name: '', country: 'SK' },
          customer: isIssued ? { name: '', country: 'SK' } : ours,
          items: [{ description: 'Faktúra', quantity: 1, unitPrice: 0, taxRate: 20 }],
        })
      } finally {
        setParsing(false)
      }
    })()
  }, [open, base64])

  async function handleSave() {
    if (!activeConfigId || !invoice) return
    setError('')
    setSaving(true)
    try {
      const saved = await window.api.invoice.create(activeConfigId, mapToEN16931(invoice))
      onImported(saved.id); onClose()
    } catch (e: any) {
      const raw: string = e?.message ?? ''
      const match = raw.match(/Error:\s*(.+)$/)
      setError(match ? match[1] : raw || 'Chyba pri ukladaní faktúry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth
      PaperProps={{ sx: { height: '90vh' } }}
    >
      <DialogTitle sx={{ py: 1.5 }}>
        {docType === 'invoice_issued' ? 'Importovať vydanú faktúru' : 'Importovať prijatú faktúru'} —{' '}
        <Typography component="span" variant="inherit" color="text.secondary">{fileName}</Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', overflow: 'hidden' }}>

        {/* PDF viewer */}
        <Box sx={{ width: '55%', borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}
          ref={(el: HTMLDivElement | null) => { if (el) setPdfWidth(el.clientWidth - 32) }}
        >
          <Box ref={scrollRef}
            sx={{ flex: 1, overflow: 'auto', bgcolor: 'grey.100', p: 2, ...(!showRaw && { cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }), ...scrollbar }}
            onMouseDown={showRaw ? undefined : onPanStart}
            onMouseMove={showRaw ? undefined : onPanMove}
            onMouseUp={showRaw ? undefined : onPanEnd}
            onMouseLeave={showRaw ? undefined : onPanEnd}
            onDoubleClick={showRaw ? undefined : onDoubleClick}
          >
            {showRaw ? (
            <Box component="pre" sx={{
              m: 0, p: 1, fontFamily: 'monospace', fontSize: 11,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'text.primary',
            }}>
              {rawText || '(prázdny text)'}
            </Box>
          ) : pdfData ? (
              <Box sx={{ width: 'fit-content', margin: '0 auto' }}>
                <Document
                  file={pdfData}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
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
              {parseSource && (
                <Chip
                  label={parseSource === 'isdoc' ? 'ISDOC' : 'text'}
                  size="small"
                  color={parseSource === 'isdoc' ? 'success' : 'default'}
                  variant="outlined"
                  sx={{ height: 20, fontSize: 10 }}
                />
              )}
              <Tooltip title="Zobraziť extrahovaný text (debug)">
                <IconButton size="small" onClick={() => setShowRaw(r => !r)} color={showRaw ? 'primary' : 'default'}>
                  <BugReport fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>

        {/* Form */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, ...scrollbar }}>
          {parsing ? (
            <Stack alignItems="center" justifyContent="center" height="100%" gap={2}>
              <CircularProgress />
              <Typography color="text.secondary">Čítam PDF…</Typography>
            </Stack>
          ) : invoice ? (
            <Stack gap={1}>
              {duplicateWarning && (
                <Alert
                  severity="warning"
                  action={onGoToDuplicate && (
                    <Button size="small" color="inherit" onClick={() => { onClose(); onGoToDuplicate() }}>
                      Zobraziť
                    </Button>
                  )}
                >
                  {duplicateWarning}
                </Alert>
              )}
              {error && <Alert severity="error">{error}</Alert>}
              <InvoiceFormContent
                invoice={invoice}
                onChange={setInvoice}
                vatEnabled={vatEnabled}
                onVatChange={setVatEnabled}
                compact
              />
            </Stack>
          ) : null}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={saving}>Zrušiť</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={parsing || saving || !invoice?.invoiceNumber || !invoice?.issueDate}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Importovať do DB
        </Button>
      </DialogActions>
    </Dialog>
  )
}
