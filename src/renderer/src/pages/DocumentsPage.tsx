import { useState } from 'react'
import {
    Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogContentText, DialogTitle, IconButton, LinearProgress, Menu, MenuItem,
    Paper, Select, Stack, Table, TableBody, TableCell,
    TableHead, TableRow, Tooltip, Typography,
} from '@mui/material'
import {
    ArrowDropDown, CloudUpload, Download, Delete, CheckCircle,
    OpenInNew, DownloadForOffline, SettingsOutlined,
    StorageOutlined, Visibility, ChevronLeft, ChevronRight, AccountBalance,
    QrCode, Receipt,
} from '@mui/icons-material'
import { ImportInvoiceDialog } from '../components/ImportInvoiceDialog'
import { XmlImportDialog } from '../components/bankTransaction/ImportDialogs'
import { BankStatementPdfDialog } from '../components/BankStatementPdfDialog'
import { QrScanDialog, fileToBase64 } from '../components/QrScanDialog'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { NoteCell } from '../components/documents/NoteCell'
import { FolderTree } from '../components/documents/FolderTree'
import { buildFolderTree, fmtSize, fmtDocDate, buildReceiptFileName } from '../utils/documentUtils'
import { TYPE_LABELS, STATUS_COLOR, STATUS_LABEL, type DocumentType } from '../models/document'
import { useDocuments } from '../hooks/useDocuments'
import { useCompany } from '../context/company'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export const DocumentsPage = ({ companyId }: { companyId: string }) => {
    const {
        documents, loading,
        uploading, uploadStatus, progress, uploadMenuOpen, setUploadMenuOpen,
        folderPreview, setFolderPreview,
        downloading,
        confirmDelete, setConfirmDelete,
        confirmDeleteAll, setConfirmDeleteAll,
        dlAllProgress,
        folder,
        previewDoc, setPreviewDoc, previewUrl, previewText,
        previewPdfPages, setPreviewPdfPages, previewLoading,
        pdfPreviewData,
        reviewQueue, reviewIndex,
        bankAccounts,
        xmlImport, setXmlImport,
        xmlImportError, setXmlImportError,
        pdfBankImport, setPdfBankImport,
        importTarget, setImportTarget,
        fileInputRef, multiInputRef, folderInputRef, uploadBtnRef,
        navigate, configId,
        handleFilesChange, handleFolderChange, handleChangeFolder,
        uploadFiles,
        handleDownload, handleDownloadAll, handleDeleteAllDownloaded,
        handlePreview, closePreview, reviewNav,
        handleBankXmlImport, handleImportToReceipts,
        handleReclassify, handleMarkProcessed, handleDelete,
    } = useDocuments(companyId)

    const { activeCompany } = useCompany()
    const [qrScanOpen, setQrScanOpen] = useState(false)

    if (loading) {
        return <Box display="flex" alignItems="center" justifyContent="center" flex={1}><CircularProgress /></Box>
    }

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="h6" fontWeight={700}>Dokumenty firmy</Typography>
                <Stack direction="row" gap={1} alignItems="center">
                    <Button variant="contained" startIcon={<CloudUpload />} endIcon={<ArrowDropDown />}
                        size="small" ref={uploadBtnRef} disabled={uploading} onClick={() => setUploadMenuOpen(true)}
                    >
                        {uploading && uploadStatus ? uploadStatus : uploading ? `${progress}%` : 'Nahrať'}
                    </Button>
                    <Menu anchorEl={uploadBtnRef.current} open={uploadMenuOpen} onClose={() => setUploadMenuOpen(false)}>
                        <MenuItem onClick={() => { setUploadMenuOpen(false); fileInputRef.current?.click() }}>Jeden súbor</MenuItem>
                        <MenuItem onClick={() => { setUploadMenuOpen(false); multiInputRef.current?.click() }}>Viacero súborov</MenuItem>
                        <MenuItem onClick={() => { setUploadMenuOpen(false); folderInputRef.current?.click() }}>Priečinok (vrátane podpriečinkov)</MenuItem>
                        <MenuItem onClick={() => { setUploadMenuOpen(false); setQrScanOpen(true) }}
                            sx={{ gap: 1 }}
                        >
                            <QrCode fontSize="small" sx={{ color: 'text.secondary' }} />
                            Skenovať QR kód z fotografie
                        </MenuItem>
                    </Menu>
                    <input ref={fileInputRef} type="file" hidden onChange={handleFilesChange} />
                    <input ref={multiInputRef} type="file" hidden multiple onChange={handleFilesChange} />
                    <input ref={folderInputRef} type="file" hidden {...({ webkitdirectory: '' } as any)} onChange={handleFolderChange} />
                </Stack>
            </Stack>

            {/* Toolbar */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                <Stack direction="row" gap={1} alignItems="center">
                    <Tooltip title={`Priečinok sťahovania: ${folder}`}>
                        <Button size="small" variant="outlined" startIcon={<SettingsOutlined fontSize="small" />}
                            onClick={handleChangeFolder} sx={{ color: 'text.secondary', textTransform: 'none' }}
                        >
                            {folder ? folder.split(/[\\/]/).pop() : '…'}
                        </Button>
                    </Tooltip>
                    <Button size="small" variant="outlined" startIcon={<OpenInNew fontSize="small" />}
                        onClick={() => window.electron.document.openCompanyFolder(window.api ? '' : '')}
                        sx={{ textTransform: 'none' }}
                    >
                        Priečinok firmy
                    </Button>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center">
                    {documents.some(d => d.status === 'uploaded') && (
                        <Button size="small" variant="outlined" color="success"
                            startIcon={dlAllProgress ? <CircularProgress size={14} color="inherit" /> : <DownloadForOffline />}
                            onClick={handleDownloadAll} disabled={!!dlAllProgress}
                        >
                            {dlAllProgress ? `${dlAllProgress.done}/${dlAllProgress.total}` : 'Stiahnuť všetky'}
                        </Button>
                    )}
                    {documents.some(d => d.status !== 'uploaded') && (
                        <Button size="small" variant="outlined" color="error" startIcon={<Delete />}
                            onClick={() => setConfirmDeleteAll(true)}
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

            {/* Neurčené dokumenty */}
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
                                    <TableCell>{fmtDocDate(d.uploadedAt)}</TableCell>
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
                                                    onClick={() => setConfirmDelete({ docId: d.id, fileName: d.fileName })}
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

            {/* Zaradené dokumenty */}
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
                                        <TableCell>{fmtDocDate(d.uploadedAt)}</TableCell>
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
                                                            const { collection: col, getDocs: gd, query: q, orderBy: ob } = await import('firebase/firestore')
                                                            const base64 = d.filePath
                                                                ? await window.electron.document.readFile(d.filePath)
                                                                : await (async () => {
                                                                    const chunksCol = col(db, 'companies', companyId, 'documents', d.id, 'chunks')
                                                                    const snap = await gd(q(chunksCol, ob('index', 'asc')))
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
                                                {d.type === 'receipt' && (d.status === 'downloaded' || d.filePath) && !d.receiptId && (
                                                    <Tooltip title="Importovať do Blokov">
                                                        <IconButton size="small" color="primary"
                                                            onClick={async () => {
                                                                const rid = await handleImportToReceipts(d)
                                                                if (rid) navigate(`/${configId}/receipts`, { state: { highlightId: rid } })
                                                            }}
                                                        >
                                                            <Receipt fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {d.type === 'receipt' && d.receiptId && (
                                                    <Tooltip title="Zobraziť blok v Blokoch">
                                                        <IconButton size="small" color="success"
                                                            onClick={() => navigate(`/${configId}/receipts`, { state: { highlightId: d.receiptId } })}
                                                        >
                                                            <OpenInNew fontSize="small" />
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
                                                            ? setConfirmDelete({ docId: d.id, fileName: d.fileName })
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

            {/* Preview Dialog */}
            <Dialog open={!!previewDoc} onClose={closePreview} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="inherit" noWrap sx={{ flex: 1 }}>{previewDoc?.fileName}</Typography>
                    <Button size="small" onClick={closePreview}>Zavrieť</Button>
                </DialogTitle>
                <DialogContent sx={{ p: 0, height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {previewLoading && <CircularProgress />}
                    {pdfPreviewData && (
                        <Box sx={{
                            flex: 1, width: '100%', overflow: 'auto', bgcolor: 'grey.100',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2,
                            '&::-webkit-scrollbar': { width: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.400', borderRadius: 2 },
                        }}>
                            <Document file={pdfPreviewData}
                                onLoadSuccess={({ numPages }) => { setPreviewPdfPages(numPages) }}
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
                                <Button key={t} size="small"
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

            {/* Confirm delete all dialog */}
            <Dialog open={confirmDeleteAll} onClose={() => setConfirmDeleteAll(false)}>
                <DialogTitle>Zmazať všetky stiahnuté záznamy?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Budú vymazané všetky záznamy so stavom <strong>Stiahnuté</strong> a <strong>Spracované</strong> ({documents.filter(d => d.status !== 'uploaded').length} záznamov).
                        Samotné súbory ostanú na disku.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDeleteAll(false)}>Zrušiť</Button>
                    <Button color="error" variant="contained"
                        onClick={() => { handleDeleteAllDownloaded(); setConfirmDeleteAll(false) }}
                    >
                        Zmazať
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Import invoice dialog */}
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

            {/* Folder preview dialog */}
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

            {/* PDF bank import dialog */}
            {pdfBankImport && (
                <BankStatementPdfDialog
                    open={!!pdfBankImport}
                    base64={pdfBankImport.base64}
                    fileName={pdfBankImport.fileName}
                    accounts={bankAccounts}
                    onClose={() => setPdfBankImport(null)}
                    onImport={async (rows, bankAccountId) => {
                        if (!configId) return
                        await window.api.bankTransaction.bulkImport(configId, rows, 0, bankAccountId)
                        await updateDoc(doc(db, 'companies', companyId, 'documents', pdfBankImport.docId), { status: 'processed' })
                        setPdfBankImport(null)
                        navigate(`/${configId}/bank`)
                    }}
                />
            )}

            {/* XML bank import dialog */}
            {xmlImport && (
                <XmlImportDialog
                    open={!!xmlImport}
                    rows={xmlImport.rows}
                    format={xmlImport.format}
                    accountIban={xmlImport.accountIban}
                    accounts={bankAccounts}
                    onClose={() => setXmlImport(null)}
                    onImport={async (rows, bankAccountId) => {
                        if (!configId) return
                        await window.api.bankTransaction.bulkImport(configId, rows, 0, bankAccountId)
                        await updateDoc(doc(db, 'companies', companyId, 'documents', xmlImport.docId), { status: 'processed' })
                        setXmlImport(null)
                        navigate(`/${configId}/bank`)
                    }}
                />
            )}

            {/* XML parse error dialog */}
            <Dialog open={!!xmlImportError} onClose={() => setXmlImportError('')}>
                <DialogTitle>Chyba pri parsovaní XML</DialogTitle>
                <DialogContent><DialogContentText>{xmlImportError}</DialogContentText></DialogContent>
                <DialogActions><Button onClick={() => setXmlImportError('')}>OK</Button></DialogActions>
            </Dialog>

            {/* Confirm delete single dialog */}
            <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
                <DialogTitle>Vymazať nestiahnutý súbor?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Súbor <strong>{confirmDelete?.fileName}</strong> ešte nebol stiahnutý.
                        Po vymazaní bude nenávratne stratený.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDelete(null)}>Zrušiť</Button>
                    <Button color="error" variant="contained"
                        onClick={() => { handleDelete(confirmDelete!.docId); setConfirmDelete(null) }}
                    >
                        Vymazať
                    </Button>
                </DialogActions>
            </Dialog>

            <QrScanDialog
                open={qrScanOpen}
                onClose={() => setQrScanOpen(false)}
                onSave={async (file, ekasaId, ekasaData) => {
                    if (!configId || !activeCompany?.id) return
                    const photoBase64 = await fileToBase64(file)
                    await window.api.receipt.create(
                        configId, activeCompany.id,
                        ekasaId, JSON.stringify(ekasaData ?? {}),
                        photoBase64, buildReceiptFileName(ekasaData, file.name),
                    )
                    window.dispatchEvent(new CustomEvent('receipts-changed'))
                }}
            />
        </Box>
    )
}
