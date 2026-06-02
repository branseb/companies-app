import { useRef, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material'
import { CheckCircle, QrCode, Save, UploadFile } from '@mui/icons-material'
import jsQR from 'jsqr'

// ── types ─────────────────────────────────────────────────────────────────

type QrKind = 'ekasa' | 'payment' | 'unknown'
type PaymentFields = { IBAN?: string; BIC?: string; AMOUNT?: string; CURRENCY?: string; VS?: string }
export type EkasaData = Record<string, unknown>

// ── utils ─────────────────────────────────────────────────────────────────

export const detectKind = (text: string): QrKind => {
  if (/^[0-9O]-[0-9a-fA-F]+$/i.test(text.trim())) return 'ekasa'
  if (text.includes('IBAN:') || text.includes('VS:'))  return 'payment'
  return 'unknown'
}

const parsePaymentQr = (text: string): PaymentFields => {
  const fields: Record<string, string> = {}
  text.split(';').forEach(part => {
    const idx = part.indexOf(':')
    if (idx > 0) fields[part.slice(0, idx).trim()] = part.slice(idx + 1).trim()
  })
  return fields as PaymentFields
}

export const fetchEkasaReceipt = async (receiptId: string): Promise<EkasaData> => {
  const res = await fetch('https://ekasa.financnasprava.sk/mdu/api/v1/opd/receipt/find', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiptId }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const r = json.receipt ?? json
  return {
    receiptId:        r.receiptId,
    ico:              r.ico ?? r.organization?.ico,
    dic:              r.dic ?? r.organization?.dic,
    organizationName: r.organization?.name,
    shopName:         r.unit?.name,
    cashRegisterCode: r.cashRegisterCode,
    receiptNumber:    r.receiptNumber,
    createDate:       r.createDate ?? r.issueDate,
    totalPrice:       r.totalPrice,
    vatAmount:        (r.vatAmountBasic ?? 0) + (r.vatAmountReduced ?? 0),
    paidByCard:       r.paidByCard ??
      (Array.isArray(r.payments)
        ? r.payments.some((p: any) =>
            /kart|card/i.test(String(p.paymentType ?? p.type ?? ''))
          )
        : false),
    address:          [r.organization?.streetName, r.organization?.municipality].filter(Boolean).join(', ') || undefined,
    items:            r.items,
  }
}

const decodeQrFromFile = (file: File): Promise<string | null> =>
  new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width; canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); resolve(null); return }
      ctx.drawImage(img, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(jsQR(data, width, height)?.data ?? null)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })

const tryDecodeQrAtAngle = (img: HTMLImageElement, angle: number): string | null => {
  const swap = angle === 90 || angle === 270
  const canvas = document.createElement('canvas')
  canvas.width  = swap ? img.height : img.width
  canvas.height = swap ? img.width  : img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((angle * Math.PI) / 180)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(data, width, height)?.data ?? null
}

export const decodeQrFromBase64 = (base64: string, mime: string): Promise<string | null> =>
  new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      for (const angle of [0, 90, 180, 270]) {
        const result = tryDecodeQrAtAngle(img, angle)
        if (result) { resolve(result); return }
      }
      resolve(null)
    }
    img.onerror = () => resolve(null)
    img.src = `data:${mime};base64,${base64}`
  })

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

// ── QrScanDialog ──────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onClose: () => void
  onSave?: (file: File, ekasaId: string, ekasaData: EkasaData | null) => Promise<void>
}

export const QrScanDialog = ({ open, onClose, onSave }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef  = useRef<File | null>(null)

  const [preview, setPreview]   = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [qrText, setQrText]     = useState<string | null>(null)
  const [kind, setKind]         = useState<QrKind | null>(null)
  const [payment, setPayment]   = useState<PaymentFields | null>(null)
  const [ekasa, setEkasa]       = useState<EkasaData | null>(null)

  const reset = () => {
    fileRef.current = null
    setPreview(null); setScanning(false); setSaving(false); setSaved(false)
    setError(''); setQrText(null); setKind(null); setPayment(null); setEkasa(null)
  }

  const handleFile = async (file: File) => {
    reset()
    fileRef.current = file
    setPreview(URL.createObjectURL(file))
    setScanning(true)
    try {
      const text = await decodeQrFromFile(file)
      if (!text) { setError('QR kód sa nepodarilo rozpoznať. Skúste ostrejšiu fotografiu.'); return }
      setQrText(text)
      const k = detectKind(text)
      setKind(k)
      if (k === 'payment') {
        setPayment(parsePaymentQr(text))
      } else if (k === 'ekasa') {
        try {
          setEkasa(await fetchEkasaReceipt(text.trim()))
        } catch (e: any) {
          setError(`Nepodarilo sa načítať dáta z Finančnej správy: ${e?.message ?? 'sieťová chyba'}`)
        }
      }
    } finally {
      setScanning(false)
    }
  }

  const handleSave = async () => {
    if (!fileRef.current || !qrText || !onSave) return
    setSaving(true); setError('')
    try {
      await onSave(fileRef.current, qrText.trim(), ekasa)
      setSaved(true)
    } catch (e: any) {
      setError(`Uloženie zlyhalo: ${e?.message ?? ''}`)
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) handleFile(file)
  }

  const handleClose = () => { reset(); onClose() }

  const canSave = !!onSave && !!qrText && !scanning && !saving && !saved

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <QrCode fontSize="small" />
        Skenovať QR kód z bloku
      </DialogTitle>

      <DialogContent>
        <Stack gap={2}>
          {!saved && (
            <Box
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              sx={{
                border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 3,
                textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <UploadFile sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Pretiahnite sem fotografiu bloku alebo kliknite pre výber
              </Typography>
              <Typography variant="caption" color="text.disabled">JPG, PNG, WEBP</Typography>
              <input ref={inputRef} type="file" hidden accept="image/*" onChange={handleInputChange} />
            </Box>
          )}

          {preview && (
            <Box sx={{ textAlign: 'center' }}>
              <Box component="img" src={preview} alt="blok"
                sx={{ maxWidth: '100%', maxHeight: 240, borderRadius: 1, objectFit: 'contain' }}
              />
            </Box>
          )}

          {scanning && (
            <Stack direction="row" alignItems="center" gap={1} justifyContent="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                {qrText ? 'Načítavam dáta z Finančnej správy…' : 'Hľadám QR kód…'}
              </Typography>
            </Stack>
          )}

          {error && <Alert severity="warning">{error}</Alert>}
          {saved  && <Alert severity="success" icon={<CheckCircle />}>Blok bol uložený.</Alert>}

          {kind === 'ekasa' && !scanning && (
            <>
              <Divider />
              <Typography variant="subtitle2" fontWeight={600}>Pokladničný blok (eKasa)</Typography>
              {ekasa
                ? <EkasaTable data={ekasa} />
                : !error
                  ? <Typography variant="body2" color="text.secondary">ID bloku: <code>{qrText}</code></Typography>
                  : null
              }
            </>
          )}

          {kind === 'payment' && payment && (
            <>
              <Divider />
              <Typography variant="subtitle2" fontWeight={600}>Platobný QR kód</Typography>
              <Stack gap={0.5}>
                {payment.IBAN   && <Row label="IBAN"              value={payment.IBAN} />}
                {payment.BIC    && <Row label="BIC / SWIFT"       value={payment.BIC} />}
                {payment.AMOUNT && <Row label="Suma"              value={`${payment.AMOUNT} ${payment.CURRENCY ?? 'EUR'}`} />}
                {payment.VS     && <Row label="Variabilný symbol" value={payment.VS} />}
              </Stack>
            </>
          )}

          {kind === 'unknown' && qrText && (
            <>
              <Divider />
              <Typography variant="subtitle2" fontWeight={600}>Obsah QR kódu</Typography>
              <Box component="pre"
                sx={{ m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
              >
                {qrText}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>{saved ? 'Zavrieť' : 'Zrušiť'}</Button>
        {!saved && (qrText || error) && (
          <Button onClick={reset} variant="outlined" size="small" disabled={saving}>Nahrať iný</Button>
        )}
        {canSave && (
          <Button
            variant="contained"
            onClick={handleSave}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            disabled={saving}
          >
            {saving ? 'Ukladám…' : 'Uložiť blok'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

// ── EkasaTable ────────────────────────────────────────────────────────────

const META_LABELS: [string, string][] = [
  ['receiptId',        'ID bloku'],
  ['ico',              'IČO'],
  ['dic',              'DIČ'],
  ['organizationName', 'Predajca'],
  ['shopName',         'Prevádzka'],
  ['cashRegisterCode', 'Kód pokladnice'],
  ['receiptNumber',    'Číslo bloku'],
  ['createDate',       'Dátum a čas'],
  ['paidByCard',       'Platba kartou'],
  ['address',          'Adresa'],
]

const PRICE_KEYS = new Set(['totalPrice', 'vatAmount'])
const KNOWN_KEYS = new Set([...META_LABELS.map(([k]) => k), ...PRICE_KEYS, 'items'])

const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const fmtPrice = (v: unknown): string => {
  if (v == null || isNaN(Number(v))) return '—'
  const n = Number(v)
  return Math.round(n * 1000) / 1000 !== Math.round(n * 100) / 100 ? n.toFixed(3) : n.toFixed(2)
}

const MetaField = ({ label, value }: { label: string; value: string }) => (
  <Stack direction="row" gap={0.5} sx={{ overflow: 'hidden', alignItems: 'baseline' }}>
    <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>{label}:</Typography>
    <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>{value}</Typography>
  </Stack>
)

type Item = Record<string, unknown>

const ItemsTable = ({ items }: { items: Item[] }) => (
  <>
    <Divider sx={{ my: 1 }} />
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: 12 }}>Položky</Typography>
    <Table size="small" sx={{ '& .MuiTableCell-root': { px: 0.5, py: 0.25, fontSize: 12 } }}>
      <TableHead>
        <TableRow>
          <TableCell>Popis</TableCell>
          <TableCell align="right">Množ.</TableCell>
          <TableCell align="right">J. cena</TableCell>
          <TableCell align="right">Suma</TableCell>
          <TableCell align="right">DPH%</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item, i) => {
          const qty      = item.quantity ?? item.qty
          const total    = item.price ?? item.totalPrice
          const unitPrice = item.unitPrice != null
            ? item.unitPrice
            : (qty != null && total != null && Number(qty) !== 0 ? Number(total) / Number(qty) : undefined)
          return (
            <TableRow key={i}>
              <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(item.name ?? item.itemName ?? '—')}
              </TableCell>
              <TableCell align="right">{fmtPrice(qty)}</TableCell>
              <TableCell align="right">{fmtPrice(unitPrice)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtPrice(total)}</TableCell>
              <TableCell align="right" sx={{ color: 'text.secondary' }}>
                {item.vatRate != null ? `${item.vatRate}%` : '—'}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  </>
)

export const EkasaTable = ({ data }: { data: EkasaData }) => {
  const extra = Object.entries(data).filter(([k, v]) => !KNOWN_KEYS.has(k) && v !== null && v !== undefined && v !== '')
  const items = Array.isArray(data.items) ? (data.items as Item[]) : null
  const hasTotal = data.totalPrice != null || data.vatAmount != null
  return (
    <Stack gap={1}>
      {/* Metadata — 2 stĺpce */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 2, rowGap: 0.25 }}>
        {META_LABELS.map(([key, label]) =>
          data[key] != null && data[key] !== '' && data[key] !== false
            ? <MetaField key={key} label={label} value={key === 'paidByCard' ? 'Áno' : fmt(data[key])} />
            : null
        )}
        {extra.map(([key, val]) => <MetaField key={key} label={key} value={fmt(val)} />)}
      </Box>
      {items && items.length > 0 && <ItemsTable items={items} />}
      {hasTotal && (
        <>
          <Divider />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 12px', justifyContent: 'flex-end', alignItems: 'baseline' }}>
            {data.vatAmount != null && <>
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'right' }}>DPH:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{fmtPrice(data.vatAmount)} €</Typography>
            </>}
            {data.totalPrice != null && <>
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'right' }}>Spolu:</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, textAlign: 'right' }}>{Number(data.totalPrice).toFixed(2)} €</Typography>
            </>}
          </Box>
        </>
      )}
    </Stack>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <Stack direction="row" gap={1}>
    <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 160, flexShrink: 0 }}>{label}:</Typography>
    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{value}</Typography>
  </Stack>
)
