import { useEffect, useRef, useState } from 'react'
import {
    Box, Button, CircularProgress, Collapse, Dialog, DialogContent,
    DialogTitle, IconButton, Paper, Stack,
    Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material'
import { Add, Delete, ExpandLess, ExpandMore, Receipt, Visibility } from '@mui/icons-material'
import { useLocation } from 'react-router-dom'
import { useCompany } from '../context/company'
import { QrScanDialog, EkasaTable, fileToBase64 } from '../components/QrScanDialog'
import { buildReceiptFileName } from '../utils/documentUtils'

type ReceiptRow = {
    id: number
    ekasaId: string
    ekasaData: Record<string, unknown> | null
    photoPath: string | null
    notes: string | null
    createdAt: string
}

const fmtDate = (iso: string) => {
    try {
        const d = new Date(iso)
        return d.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch { return iso }
}

const fmtEkasaDate = (raw: unknown): string => {
    if (!raw) return '—'
    const s = String(raw)
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})T?(\d{2}:\d{2})?/)
    if (m) return `${m[3]}.${m[2]}.${m[1]}${m[4] ? ' ' + m[4] : ''}`
    return s
}

const getField = (data: Record<string, unknown> | null, ...keys: string[]): string => {
    if (!data) return '—'
    for (const k of keys) {
        if (data[k] != null && data[k] !== '') return String(data[k])
    }
    return '—'
}

// ── Foto dialóg ───────────────────────────────────────────────────────────

const PhotoDialog = ({ receipt, configId, onClose }: { receipt: ReceiptRow; configId: string; onClose: () => void }) => {
    const [imgSrc, setImgSrc]   = useState<string | null>(null)
    const [loading, setLoading] = useState(!!receipt.photoPath)
    const blobUrlRef            = useRef<string | null>(null)

    useEffect(() => {
        if (!receipt.photoPath) { setLoading(false); return }
        let cancelled = false
        window.api.receipt.loadPhoto(configId, receipt.photoPath).then(b64 => {
            if (cancelled || !b64) return
            const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/jpeg' })
            const url  = URL.createObjectURL(blob)
            blobUrlRef.current = url
            setImgSrc(url)
        }).finally(() => { if (!cancelled) setLoading(false) })
        return () => {
            cancelled = true
            if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
        }
    }, [receipt.id])

    const e = receipt.ekasaData
    const title = e ? getField(e, 'organizationName', 'shopName') : receipt.ekasaId

    return (
        <Dialog open onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5 }}>
                <Receipt fontSize="small" />
                {title}
                {!!e?.createDate && (
                    <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
                        — {fmtEkasaDate(e.createDate)}
                    </Typography>
                )}
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', minHeight: 300 }}>
                {loading ? <CircularProgress /> : imgSrc ? (
                    <Box component="img" src={imgSrc} alt="blok"
                        sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 1 }}
                    />
                ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Fotka nebola uložená.</Typography>
                )}
            </DialogContent>
        </Dialog>
    )
}

// ── Collapse obsah ────────────────────────────────────────────────────────

const ReceiptCollapseContent = ({ receipt }: { receipt: ReceiptRow }) => {
    const e = receipt.ekasaData
    return (
        <Box sx={{ bgcolor: 'action.hover', borderTop: '1px solid', borderColor: 'divider', px: 2, py: 1.5, maxHeight: 380, overflowY: 'auto' }}>
            {e
                ? <EkasaTable data={e} />
                : <Typography variant="body2" sx={{ color: 'text.secondary' }}>Žiadne eKasa dáta.</Typography>
            }
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
                Uložené: {fmtDate(receipt.createdAt)}
                {receipt.notes ? ` · ${receipt.notes}` : ''}
            </Typography>
        </Box>
    )
}

// ── ReceiptsPage ──────────────────────────────────────────────────────────

export const ReceiptsPage = ({ companyId }: { companyId: string }) => {
    const { activeConfigId, activeCompany } = useCompany()
    const location = useLocation()
    const [receipts, setReceipts]     = useState<ReceiptRow[]>([])
    const [loading, setLoading]       = useState(true)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [photoReceipt, setPhotoReceipt] = useState<ReceiptRow | null>(null)
    const [scanOpen, setScanOpen]     = useState(false)

    const load = async () => {
        if (!activeConfigId || !activeCompany?.id) return
        setLoading(true)
        try {
            const rows = await window.api.receipt.byCompany(activeConfigId, activeCompany.id)
            setReceipts(rows)
            const highlightId = (location.state as any)?.highlightId as number | undefined
            if (highlightId) setExpandedId(highlightId)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [activeConfigId, activeCompany?.id])

    useEffect(() => {
        window.addEventListener('receipts-changed', load)
        return () => window.removeEventListener('receipts-changed', load)
    }, [activeConfigId, activeCompany?.id])

    const handleDelete = async (id: number) => {
        if (!activeConfigId) return
        await window.api.receipt.delete(activeConfigId, id)
        setReceipts(r => r.filter(x => x.id !== id))
        if (expandedId === id) setExpandedId(null)
    }

    const toggle = (id: number) => setExpandedId(prev => prev === id ? null : id)

    if (loading) {
        return <Box display="flex" alignItems="center" justifyContent="center" flex={1}><CircularProgress /></Box>
    }

    return (
        <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6" fontWeight={700}>Bloky</Typography>
                <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {receipts.length} {receipts.length === 1 ? 'blok' : receipts.length < 5 ? 'bloky' : 'blokov'}
                    </Typography>
                    <Button variant="contained" startIcon={<Add />} size="small" onClick={() => setScanOpen(true)}>
                        Pridať blok
                    </Button>
                </Stack>
            </Stack>

            {receipts.length === 0 ? (
                <Paper sx={{ p: 6, textAlign: 'center' }}>
                    <Receipt sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography sx={{ color: 'text.secondary' }}>
                        Zatiaľ žiadne bloky. Pridajte ich cez Dokumenty → Skenovať QR kód z bloku.
                    </Typography>
                </Paper>
            ) : (
                <Paper>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell width={32} />
                                <TableCell>Dátum bloku</TableCell>
                                <TableCell>Predajca</TableCell>
                                <TableCell>IČO</TableCell>
                                <TableCell align="right">Suma</TableCell>
                                <TableCell align="right">DPH</TableCell>
                                <TableCell>Číslo bloku</TableCell>
                                <TableCell align="right">Akcie</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {receipts.map(r => {
                                const e = r.ekasaData
                                const expanded = expandedId === r.id
                                return (
                                    <>
                                        <TableRow
                                            key={r.id}
                                            hover
                                            sx={{ cursor: 'pointer', ...(expanded && { bgcolor: 'action.selected' }) }}
                                            onClick={() => toggle(r.id)}
                                        >
                                            <TableCell sx={{ p: 0, pl: 0.5 }}>
                                                {expanded ? <ExpandLess fontSize="small" sx={{ color: 'text.secondary' }} /> : <ExpandMore fontSize="small" sx={{ color: 'text.secondary' }} />}
                                            </TableCell>
                                            <TableCell>
                                                {e?.createDate ? fmtEkasaDate(e.createDate) : fmtDate(r.createdAt)}
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {getField(e, 'organizationName', 'shopName')}
                                            </TableCell>
                                            <TableCell>{getField(e, 'ico')}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                {e?.totalPrice != null ? `${Number(e.totalPrice).toFixed(2)} €` : '—'}
                                            </TableCell>
                                            <TableCell align="right" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                                {e?.vatAmount != null ? `${Number(e.vatAmount).toFixed(2)} €` : '—'}
                                            </TableCell>
                                            <TableCell>{getField(e, 'receiptNumber')}</TableCell>
                                            <TableCell align="right" onClick={ev => ev.stopPropagation()}>
                                                <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                                                    {r.photoPath && (
                                                        <Tooltip title="Zobraziť fotku">
                                                            <IconButton size="small" onClick={() => setPhotoReceipt(r)}>
                                                                <Visibility fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip title="Vymazať">
                                                        <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow key={`${r.id}-collapse`}>
                                            <TableCell colSpan={8} sx={{ p: 0, borderBottom: expanded ? undefined : 'none' }}>
                                                <Collapse in={expanded} unmountOnExit>
                                                    <ReceiptCollapseContent receipt={r} />
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </>
                                )
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {photoReceipt && activeConfigId && (
                <PhotoDialog
                    receipt={photoReceipt}
                    configId={activeConfigId}
                    onClose={() => setPhotoReceipt(null)}
                />
            )}

            <QrScanDialog
                open={scanOpen}
                onClose={() => setScanOpen(false)}
                onSave={async (file, ekasaId, ekasaData) => {
                    if (!activeConfigId || !activeCompany?.id) return
                    const photoBase64 = await fileToBase64(file)
                    await window.api.receipt.create(
                        activeConfigId, activeCompany.id,
                        ekasaId, JSON.stringify(ekasaData ?? {}),
                        photoBase64, buildReceiptFileName(ekasaData, file.name),
                    )
                    await load()
                }}
            />
        </Box>
    )
}
