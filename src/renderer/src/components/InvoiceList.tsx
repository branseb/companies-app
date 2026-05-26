import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Collapse,
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
import { Add, CheckCircle, DeleteOutline, Download, Edit, FileDownload, FileUpload, KeyboardArrowDown, KeyboardArrowUp, RadioButtonUnchecked } from "@mui/icons-material";
import { CircularProgress } from "@mui/material";
import { ReceivedInvoiceForm } from "./ReceivedInvoiceForm";
import { tryParse, formatDate, isOverdue, fmtMoney, computeTotal, downloadCSV } from "./invoice/invoiceUtils";
import { InvoiceDetail } from "./invoice/InvoiceDetail";
import { XmlPreviewDialog } from "./invoice/XmlPreviewDialog";
import { useInvoiceList } from "../hooks/useInvoiceList";

type Props = {
    type: "issued" | "received";
    refresh: boolean;
    onAdd?: () => void;
}

const LABELS = {
    issued:   "Vydané faktúry",
    received: "Prijaté faktúry",
};

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear, currentYear - 1, currentYear - 2];

export const InvoiceList: React.FC<Props> = ({ type, refresh, onAdd }) => {
    const location = useLocation();
    const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "overdue" | "paid">("all");
    const [yearFilter, setYearFilter] = useState<number | "all">(currentYear);
    const [showForm, setShowForm] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Parameters<typeof ReceivedInvoiceForm>[0]["editInvoice"]>(undefined);
    const fileRef = useRef<HTMLInputElement>(null);

    const {
        invoices, loading, pdfLoading,
        expandedId, setExpandedId, highlightId, setHighlightId, highlightRowRef,
        xmlInvoice, xmlFormat, xmlDialog, setXmlDialog,
        snackbar, closeSnackbar,
        loadInvoices, handleDownload, handleDelete, handleTogglePaid,
        handleFile, handleImport, toggle,
    } = useInvoiceList(type, refresh, onAdd);

    useEffect(() => {
        const id = (location.state as { highlightId?: number } | null)?.highlightId;
        if (!id) return;
        const strId = String(id);
        setExpandedId(strId);
        setHighlightId(strId);
        setYearFilter("all");
        setStatusFilter("all");
        const fade = setTimeout(() => setHighlightId(null), 3500);
        return () => clearTimeout(fade);
    }, [location.key]);

    const filteredInvoices = invoices.filter(inv => {
        if (yearFilter !== "all" && !inv.issueDate.startsWith(String(yearFilter))) return false;
        if (statusFilter === "paid")    return inv.paid;
        if (statusFilter === "unpaid")  return !inv.paid;
        if (statusFilter === "overdue") return !inv.paid && isOverdue(inv);
        return true;
    });

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

    return (
        <Paper style={{ padding: 20 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap="wrap" gap={1}>
                <Typography variant="h5">{LABELS[type]}</Typography>
                <Stack direction="row" gap={1} alignItems="center">
                    {type === "received" && (
                        <Button variant="contained" size="small" startIcon={<Add />}
                            onClick={() => { setEditingInvoice(undefined); setShowForm(s => !s); }}>
                            {showForm && !editingInvoice ? "Zrušiť" : "Pridať faktúru"}
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
                <ReceivedInvoiceForm
                    editInvoice={editingInvoice}
                    onAdd={() => { setShowForm(false); setEditingInvoice(undefined); loadInvoices(); onAdd?.(); }}
                />
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
                                const isHighlighted = highlightId === inv.id;
                                return (
                                    <React.Fragment key={inv.id}>
                                        <TableRow
                                            ref={isHighlighted ? highlightRowRef : null}
                                            hover
                                            onClick={() => toggle(inv.id)}
                                            sx={{
                                                cursor: "pointer",
                                                bgcolor: isHighlighted ? "#fff8e1" : overdue ? "error.50" : undefined,
                                                boxShadow: isHighlighted ? "inset 0 0 0 2px #f9a825" : undefined,
                                                transition: "background-color 2s ease, box-shadow 2s ease",
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
                                                        <span>
                                                            <IconButton size="small" onClick={e => handleDownload(inv.id, e)} disabled={pdfLoading === inv.id}>
                                                                {pdfLoading === inv.id
                                                                    ? <CircularProgress size={16} />
                                                                    : <Download fontSize="small" />}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                )}
                                                {type === "received" && (
                                                    <Tooltip title="Upraviť faktúru">
                                                        <IconButton size="small" onClick={e => {
                                                            e.stopPropagation();
                                                            setEditingInvoice(inv);
                                                            setShowForm(true);
                                                            setExpandedId(null);
                                                        }}>
                                                            <Edit fontSize="small" />
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

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={closeSnackbar}>
                <Alert severity={snackbar.severity} onClose={closeSnackbar}>{snackbar.message}</Alert>
            </Snackbar>
        </Paper>
    );
};
