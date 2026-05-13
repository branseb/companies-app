import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    LinearProgress,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import { Add, CheckCircle, DeleteOutline, Download, FileDownload, FileUpload, KeyboardArrowDown, KeyboardArrowUp, RadioButtonUnchecked } from "@mui/icons-material";
import { useCompany } from "../context/company";
import { parseInvoiceXML } from "../utils/parseInvoiceXML";
import type { EN16931Invoice } from "../models/EN16931Invoice";
import { ReceivedInvoiceForm } from "./ReceivedInvoiceForm";

interface InvoiceRow {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    deliveryDate?: string;
    currency: string;
    supplier: string;
    customer: string;
    items: string;
    paid?: boolean;
    paidDate?: string;
}

interface Props {
    type: "issued" | "received";
    refresh: boolean;
    onAdd?: () => void;
}

const LABELS = {
    issued:   "Vydané faktúry",
    received: "Prijaté faktúry",
};

const DetailField: React.FC<{ label: string; value?: string }> = ({ label, value }) =>
    value ? (
        <>
            <Grid size={{ xs: 4 }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
            </Grid>
            <Grid size={{ xs: 8 }}>
                <Typography variant="caption">{value}</Typography>
            </Grid>
        </>
    ) : null;

const InvoiceDetail: React.FC<{ inv: InvoiceRow; type: "issued" | "received" }> = ({ inv, type }) => {
    const supplier = tryParse(inv.supplier);
    const customer = tryParse(inv.customer);
    const items: any[] = tryParse(inv.items) ?? [];

    const party = type === "issued" ? customer : supplier;
    const partyLabel = type === "issued" ? "Zákazník" : "Dodávateľ";

    return (
        <Box sx={{ px: 3, py: 2, bgcolor: "grey.50" }}>
            <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="overline" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
                        {partyLabel}
                    </Typography>
                    <Grid container rowSpacing={0.5}>
                        <DetailField label="Názov" value={party?.partyName} />
                        <DetailField label="IČO" value={party?.partyLegalEntity?.companyID} />
                        <DetailField label="IČ DPH" value={party?.partyTaxScheme?.companyID} />
                        <DetailField label="Mesto" value={party?.postalAddress?.cityName} />
                    </Grid>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="overline" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
                        Faktúra
                    </Typography>
                    <Grid container rowSpacing={0.5}>
                        <DetailField label="Vystavená" value={formatDate(inv.issueDate)} />
                        <DetailField label="Splatnosť" value={formatDate(inv.dueDate)} />
                        <DetailField label="Mena" value={inv.currency} />
                    </Grid>
                </Grid>

                {items.length > 0 && (
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Typography variant="overline" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
                            Položky
                        </Typography>
                        {items.map((item, i) => (
                            <Box key={i} sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                <Typography variant="caption">{item.item?.name ?? item.description}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 2, whiteSpace: "nowrap" }}>
                                    {item.invoicedQuantity} × {item.price?.priceAmount?.toFixed(2)}
                                </Typography>
                            </Box>
                        ))}
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};

function tryParse(json: string) {
    try { return JSON.parse(json); } catch { return null; }
}

function formatDate(date?: string) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("sk-SK");
}

function isOverdue(inv: InvoiceRow): boolean {
    if (inv.paid) return false;
    if (!inv.dueDate) return false;
    return new Date(inv.dueDate) < new Date(new Date().toDateString());
}

function fmtMoney(n: number, currency: string) {
    return new Intl.NumberFormat("sk-SK", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

// ── XML import preview ────────────────────────────────────────────────────────

const XmlPreviewDialog: React.FC<{
    invoice: EN16931Invoice | null;
    format: string;
    open: boolean;
    onClose: () => void;
    onConfirm: (inv: EN16931Invoice) => void;
}> = ({ invoice, format, open, onClose, onConfirm }) => {
    if (!invoice) return null;

    const supplier = invoice.accountingSupplierParty;
    const customer = invoice.accountingCustomerParty;
    const total = invoice.legalMonetaryTotal;
    const currency = invoice.documentCurrencyCode;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                Import faktúry — {format}
            </DialogTitle>
            <DialogContent dividers>
                <Stack gap={2}>
                    <Alert severity="info">
                        Faktúra č. <strong>{invoice.id}</strong> bude uložená do databázy.
                    </Alert>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="overline" color="text.secondary" display="block">Dodávateľ</Typography>
                            <Typography fontWeight={600}>{supplier.partyName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                IČO: {supplier.partyLegalEntity?.companyID}
                                {supplier.partyTaxScheme?.companyID && ` | IČ DPH: ${supplier.partyTaxScheme.companyID}`}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {[supplier.postalAddress.streetName, supplier.postalAddress.cityName].filter(Boolean).join(", ")}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="overline" color="text.secondary" display="block">Odberateľ</Typography>
                            <Typography fontWeight={600}>{customer.partyName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                IČO: {customer.partyLegalEntity?.companyID}
                                {customer.partyTaxScheme?.companyID && ` | IČ DPH: ${customer.partyTaxScheme.companyID}`}
                            </Typography>
                        </Grid>
                    </Grid>

                    <Divider />

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="caption" color="text.secondary" display="block">Číslo</Typography>
                            <Typography>{invoice.id}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="caption" color="text.secondary" display="block">Vystavená</Typography>
                            <Typography>{formatDate(invoice.issueDate)}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="caption" color="text.secondary" display="block">Splatnosť</Typography>
                            <Typography>{formatDate(invoice.dueDate)}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="caption" color="text.secondary" display="block">Mena</Typography>
                            <Typography>{currency}</Typography>
                        </Grid>
                    </Grid>

                    <Divider />

                    <Typography variant="overline" color="text.secondary">Položky</Typography>
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: "grey.50" }}>
                                    <TableCell>Názov</TableCell>
                                    <TableCell align="right">Množstvo</TableCell>
                                    <TableCell align="right">Cena / ks</TableCell>
                                    <TableCell align="right">Spolu bez DPH</TableCell>
                                    <TableCell align="right">DPH %</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {invoice.invoiceLine.map((line, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{line.item.name}</TableCell>
                                        <TableCell align="right">{line.invoicedQuantity}</TableCell>
                                        <TableCell align="right">{fmtMoney(line.price.priceAmount, currency)}</TableCell>
                                        <TableCell align="right">{fmtMoney(line.lineExtensionAmount, currency)}</TableCell>
                                        <TableCell align="right">{line.item.classifiedTaxCategory.percent} %</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Stack direction="row" gap={2} justifyContent="flex-end" flexWrap="wrap">
                        <Chip label={`Bez DPH: ${fmtMoney(total.taxExclusiveAmount, currency)}`} variant="outlined" />
                        <Chip
                            label={`Na úhradu: ${fmtMoney(total.payableAmount, currency)}`}
                            color="primary"
                            sx={{ fontWeight: 700 }}
                        />
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zrušiť</Button>
                <Button variant="contained" onClick={() => onConfirm(invoice)}>
                    Uložiť faktúru
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear, currentYear - 1, currentYear - 2];

function computeTotal(itemsJson: string): number {
    const items = tryParse(itemsJson) ?? [];
    return items.reduce((s: number, it: any) => {
        const net = it.lineExtensionAmount ?? 0;
        const vat = it.item?.classifiedTaxCategory?.percent ?? 0;
        return s + net * (1 + vat / 100);
    }, 0);
}

function downloadCSV(content: string, filename: string) {
    const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

export const InvoiceList: React.FC<Props> = ({ type, refresh, onAdd }) => {
    const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "overdue" | "paid">("all");
    const [yearFilter, setYearFilter] = useState<number | "all">(currentYear);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const { activeCompany } = useCompany();

    const fileRef = useRef<HTMLInputElement>(null);
    const [xmlInvoice, setXmlInvoice] = useState<EN16931Invoice | null>(null);
    const [xmlFormat, setXmlFormat] = useState("");
    const [xmlDialog, setXmlDialog] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
        open: false, message: "", severity: "success",
    });

    useEffect(() => { loadInvoices(); }, [type, refresh, activeCompany]);

    const handleDownload = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const filePath = await window.electron.pdf.download(id);
            window.electron.pdf.open(filePath);
        } catch (err) {
            console.error("PDF download failed:", err);
        }
    };

    const loadInvoices = () => {
        if (!activeCompany) return;
        setLoading(true);
        const fetch = type === "issued"
            ? window.api.invoice.byCompany(activeCompany.ico)
            : window.api.invoice.byCustomer(activeCompany.ico);
        fetch.then(setInvoices).finally(() => setLoading(false));
    };

    const handleExportCSV = () => {
        const sep = ";";
        const partyCol = type === "issued" ? "Zákazník" : "Dodávateľ";
        const header = ["Číslo faktúry", "Dátum vystavenia", "Splatnosť", partyCol, "IČO", "Mena", "Suma s DPH", "Stav"].join(sep);
        const rows = filteredInvoices.map(inv => {
            const party = tryParse(type === "issued" ? inv.customer : inv.supplier);
            const total = computeTotal(inv.items);
            return [
                inv.invoiceNumber,
                formatDate(inv.issueDate),
                formatDate(inv.dueDate),
                party?.partyName ?? "",
                party?.partyLegalEntity?.companyID ?? "",
                inv.currency,
                total.toFixed(2).replace(".", ","),
                inv.paid ? "Uhradená" : (isOverdue(inv) ? "Po splatnosti" : "Neuhradená"),
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(sep);
        });
        const year = yearFilter === "all" ? "vsetky" : yearFilter;
        downloadCSV([header, ...rows].join("\n"), `faktury_${type}_${year}.csv`);
    };

    const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await window.api.invoice.delete(Number(id));
        setInvoices(prev => prev.filter(i => i.id !== id));
    };

    const handleTogglePaid = async (inv: InvoiceRow, e: React.MouseEvent) => {
        e.stopPropagation();
        const newPaid = !inv.paid;
        const newPaidDate = newPaid ? new Date().toISOString().split("T")[0] : undefined;
        await window.api.invoice.markPaid(Number(inv.id), newPaid);
        setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, paid: newPaid, paidDate: newPaidDate } : i));
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const text = ev.target?.result as string;
            const result = parseInvoiceXML(text);
            if ("error" in result) {
                setSnackbar({ open: true, message: result.error, severity: "error" });
            } else {
                setXmlInvoice(result.invoice);
                setXmlFormat(result.format);
                setXmlDialog(true);
            }
        };
        reader.readAsText(file, "utf-8");
        e.target.value = "";
    };

    const handleImport = async (invoice: EN16931Invoice) => {
        try {
            await window.api.invoice.create(invoice);
            setXmlDialog(false);
            onAdd?.();
            loadInvoices();
            setSnackbar({ open: true, message: "Faktúra importovaná", severity: "success" });
        } catch {
            setSnackbar({ open: true, message: "Chyba pri importe faktúry", severity: "error" });
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        if (yearFilter !== "all" && !inv.issueDate.startsWith(String(yearFilter))) return false;
        if (statusFilter === "paid")    return inv.paid;
        if (statusFilter === "unpaid")  return !inv.paid;
        if (statusFilter === "overdue") return !inv.paid && isOverdue(inv);
        return true;
    });

    return (
        <Paper style={{ padding: 20 }}>
            {/* Row 1: title + actions */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap="wrap" gap={1}>
                <Typography variant="h5">{LABELS[type]}</Typography>
                <Stack direction="row" gap={1} alignItems="center">
                    {type === "received" && (
                        <Button variant="contained" size="small" startIcon={<Add />}
                            onClick={() => setShowForm(s => !s)}>
                            {showForm ? "Zrušiť" : "Pridať faktúru"}
                        </Button>
                    )}
                    <Button variant="outlined" size="small" startIcon={<FileDownload />}
                        onClick={handleExportCSV} disabled={filteredInvoices.length === 0}>
                        Export CSV
                    </Button>
                    <Button variant="outlined" size="small" startIcon={<FileUpload />}
                        onClick={() => fileRef.current?.click()}>
                        Importovať XML
                    </Button>
                </Stack>
            </Stack>

            {/* Row 2: filters */}
            <Stack direction="row" alignItems="center" gap={1.5} mb={2} flexWrap="wrap">
                <Select size="small" value={yearFilter}
                    onChange={e => setYearFilter(e.target.value as number | "all")}
                    sx={{ minWidth: 110 }}>
                    <MenuItem value="all">Všetky roky</MenuItem>
                    {YEAR_OPTIONS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
                <ToggleButtonGroup size="small" exclusive value={statusFilter}
                    onChange={(_, v) => v && setStatusFilter(v)}>
                    <ToggleButton value="all">Všetky</ToggleButton>
                    <ToggleButton value="unpaid">Neuhradené</ToggleButton>
                    <ToggleButton value="overdue" sx={{ color: "error.main" }}>Po splatnosti</ToggleButton>
                    <ToggleButton value="paid">Uhradené</ToggleButton>
                </ToggleButtonGroup>
                {filteredInvoices.length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                        {filteredInvoices.length} faktúr
                    </Typography>
                )}
            </Stack>

            <input ref={fileRef} type="file" accept=".xml" hidden onChange={handleFile} />
            {loading && <LinearProgress sx={{ mb: 1 }} />}

            {showForm && type === "received" && (
                <ReceivedInvoiceForm onAdd={() => { setShowForm(false); loadInvoices(); onAdd?.(); }} />
            )}

            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox" />
                            <TableCell>Číslo faktúry</TableCell>
                            <TableCell>{type === "issued" ? "Zákazník" : "Dodávateľ"}</TableCell>
                            <TableCell>Dátum vystavenia</TableCell>
                            <TableCell align="right">Suma s DPH</TableCell>
                            <TableCell>Mena</TableCell>
                            <TableCell>Stav</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredInvoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <Box py={2}>
                                        <Typography color="text.secondary" variant="body2">
                                            Žiadne faktúry
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredInvoices.map(inv => {
                                const expanded = expandedId === inv.id;
                                const overdue = isOverdue(inv);
                                return (
                                    <React.Fragment key={inv.id}>
                                        <TableRow
                                            hover
                                            onClick={() => toggle(inv.id)}
                                            sx={{
                                                cursor: "pointer",
                                                bgcolor: overdue ? "error.50" : undefined,
                                                "& > *": { borderBottom: expanded ? "unset" : undefined },
                                            }}
                                        >
                                            <TableCell padding="checkbox">
                                                <IconButton size="small">
                                                    {expanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                                                </IconButton>
                                            </TableCell>
                                            <TableCell>{inv.invoiceNumber}</TableCell>
                                            <TableCell>
                                                {tryParse(type === "issued" ? inv.customer : inv.supplier)?.partyName}
                                            </TableCell>
                                            <TableCell>{formatDate(inv.issueDate)}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 500 }}>
                                                {fmtMoney(computeTotal(inv.items), inv.currency)}
                                            </TableCell>
                                            <TableCell>{inv.currency}</TableCell>
                                            <TableCell padding="none" sx={{ whiteSpace: "nowrap" }}>
                                                <Stack direction="row" alignItems="center" gap={0.5}>
                                                    <Tooltip title={inv.paid ? "Označiť ako neuhradenú" : "Označiť ako uhradenú"}>
                                                        <IconButton size="small" onClick={e => handleTogglePaid(inv, e)}>
                                                            {inv.paid
                                                                ? <CheckCircle fontSize="small" color="success" />
                                                                : <RadioButtonUnchecked fontSize="small" sx={{ opacity: overdue ? 0.8 : 0.25 }} color={overdue ? "error" : "inherit"} />}
                                                        </IconButton>
                                                    </Tooltip>
                                                    {inv.paid
                                                        ? <Typography variant="caption" color="success.main">{inv.paidDate ? formatDate(inv.paidDate) : "Uhradená"}</Typography>
                                                        : overdue
                                                            ? <Typography variant="caption" color="error.main" fontWeight={600}>Po splatnosti</Typography>
                                                            : <Typography variant="caption" color="text.disabled">Neuhradená</Typography>
                                                    }
                                                </Stack>
                                            </TableCell>
                                            <TableCell align="right" padding="none" sx={{ whiteSpace: "nowrap" }}>
                                                {type === "issued" && (
                                                    <Tooltip title="Stiahnuť PDF">
                                                        <IconButton size="small" onClick={e => handleDownload(inv.id, e)}>
                                                            <Download fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                <Tooltip title="Vymazať faktúru">
                                                    <IconButton size="small" color="error" onClick={e => handleDelete(inv.id, e)}>
                                                        <DeleteOutline fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell colSpan={7} sx={{ py: 0, border: expanded ? undefined : "none" }}>
                                                <Collapse in={expanded} timeout="auto" unmountOnExit>
                                                    <InvoiceDetail inv={inv} type={type} />
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <XmlPreviewDialog
                invoice={xmlInvoice}
                format={xmlFormat}
                open={xmlDialog}
                onClose={() => setXmlDialog(false)}
                onConfirm={handleImport}
            />

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Paper>
    );
};
