import React, { useEffect, useRef, useState } from "react";
import {
    Alert, Button, Chip, IconButton, Paper, Popover, Snackbar, Stack,
    Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import { Add, AutoAwesome, DeleteOutline, EditNote, FileUpload, LinkOff, LocalAtm, ManageAccounts } from "@mui/icons-material";
import { useCompany } from "../context/company";
import { BankTransactionForm } from "./BankTransactionForm";
import { CsvImportDialog, XmlImportDialog } from "./bankTransaction/ImportDialogs";
import { AutoMatchDialog, LinkInvoiceDialog } from "./bankTransaction/InvoiceDialogs";
import { BankAccountsDialog } from "./bankTransaction/BankAccountsDialog";
import { buildSuggestions, parseCSV, parseXML } from "../utils/bankTransactionParsers";
import { fmtDate } from "../utils/formatters";
import { useSnackbar } from "../hooks/useSnackbar";
import { useInvoices } from "../hooks/useInvoices";
import { useBankTransactions } from "../hooks/useBankTransactions";
import { SummaryChips } from "./shared/SummaryChips";
import { LinkedInvoiceChip, UnlinkedInvoiceButton } from "./shared/LinkedInvoiceChip";
import type { ImportRow, MatchSuggestion, Tx } from "../models/bankTransaction";
import { fmtCurrency } from "../utils/formatters";

export const BankTransactionList: React.FC = () => {
    const { activeCompany, activeConfigId } = useCompany();
    const { transactions, setTransactions, accounts, load, loadAccounts } = useBankTransactions();
    const { invoices, loadInvoices } = useInvoices();
    const { snackbar, showSnackbar, closeSnackbar } = useSnackbar();

    const [cashEntries, setCashEntries] = useState<{ id: number; date: string; amount: number; currency: string; description?: string; cashRegisterId?: number }[]>([]);
    const [cashRegisters, setCashRegisters] = useState<{ id: number; name: string }[]>([]);
    const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
    const [manageDialog, setManageDialog] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const fileRef = useRef<HTMLInputElement>(null);
    const [csvDialog, setCsvDialog] = useState<{ open: boolean; rows: string[][] }>({ open: false, rows: [] });
    const [xmlDialog, setXmlDialog] = useState<{ open: boolean; rows: ImportRow[]; format: string; accountIban?: string }>({ open: false, rows: [], format: "" });
    const [search, setSearch] = useState("");

    const [linkTarget, setLinkTarget] = useState<Tx | null>(null);
    const [autoSuggestions, setAutoSuggestions] = useState<MatchSuggestion[]>([]);

    const [noteAnchor, setNoteAnchor] = useState<HTMLElement | null>(null);
    const [noteTarget, setNoteTarget] = useState<{ id: number; note: string } | null>(null);

    const loadCash = async () => {
        if (!activeCompany?.id) return;
        const [entries, regs] = await Promise.all([
            window.api.cashEntry.byCompany(activeConfigId!, activeCompany.id),
            window.api.cashRegister.byCompany(activeConfigId!, activeCompany.id),
        ]);
        setCashEntries(entries);
        setCashRegisters(regs);
    };

    useEffect(() => { load(); loadInvoices(); loadAccounts(); loadCash(); }, [load, loadInvoices, loadAccounts]);

    const handleDelete = async (id: number) => {
        await window.api.bankTransaction.delete(activeConfigId!, id);
        load();
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const text = ev.target?.result as string;
            if (file.name.toLowerCase().endsWith(".xml")) {
                const result = parseXML(text);
                if ("error" in result) showSnackbar(result.error, "error");
                else setXmlDialog({ open: true, rows: result.rows, format: result.format, accountIban: result.accountIban });
            } else {
                const rows = parseCSV(text);
                if (rows.length) setCsvDialog({ open: true, rows });
            }
        };
        reader.readAsText(file, "utf-8");
        e.target.value = "";
    };

    const handleImport = async (rows: ImportRow[], bankAccountId?: number) => {
        if (!activeCompany?.id || !rows.length) { showSnackbar("Žiadne platné riadky na import", "error"); return; }
        try {
            await window.api.bankTransaction.bulkImport(activeConfigId!, rows, activeCompany.id, bankAccountId ?? activeAccountId ?? undefined);
            setCsvDialog(d => ({ ...d, open: false }));
            setXmlDialog(d => ({ ...d, open: false }));
            load();
            showSnackbar(`Importovaných ${rows.length} pohybov`);
        } catch { showSnackbar("Chyba pri importe", "error"); }
    };

    const handleLink = async (txId: number, invoiceId: number) => {
        await window.api.bankTransaction.linkInvoice(activeConfigId!, txId, invoiceId);
        setTransactions(prev => prev.map(t => t.id === txId ? { ...t, linkedInvoiceId: invoiceId } : t));
        setLinkTarget(null);
    };

    const handleUnlink = async (txId: number) => {
        await window.api.bankTransaction.linkInvoice(activeConfigId!, txId, null);
        setTransactions(prev => prev.map(t => t.id === txId ? { ...t, linkedInvoiceId: undefined } : t));
    };

    const handleAutoApply = async (selected: MatchSuggestion[]) => {
        await Promise.all(selected.map(s => window.api.bankTransaction.linkInvoice(activeConfigId!, s.tx.id, s.invoice.id)));
        setTransactions(prev => prev.map(t => {
            const m = selected.find(s => s.tx.id === t.id);
            return m ? { ...t, linkedInvoiceId: m.invoice.id } : t;
        }));
        setAutoSuggestions([]);
    };

    const saveNote = async () => {
        if (!noteTarget) return;
        await window.api.bankTransaction.updateNote(activeConfigId!, noteTarget.id, noteTarget.note);
        setTransactions(prev => prev.map(t => t.id === noteTarget.id ? { ...t, note: noteTarget.note || undefined } : t));
        setNoteAnchor(null);
    };

    const byAccount = activeAccountId === null ? transactions : transactions.filter(t => t.bankAccountId === activeAccountId);
    const q = search.toLowerCase();
    const displayed = q
        ? byAccount.filter(t =>
            t.description?.toLowerCase().includes(q) ||
            t.counterpartyName?.toLowerCase().includes(q) ||
            t.counterpartyIban?.toLowerCase().includes(q) ||
            t.variableSymbol?.toLowerCase().includes(q) ||
            t.note?.toLowerCase().includes(q))
        : byAccount;

    const income  = displayed.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = displayed.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    const currency = displayed[0]?.currency ?? accounts.find(a => a.id === activeAccountId)?.currency ?? "EUR";

    return (
        <Stack gap={3}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Typography variant="h5" fontWeight={700}>Bankové pohyby</Typography>
                <Stack direction="row" gap={1}>
                    <Tooltip title="Spravovať bankové účty">
                        <IconButton onClick={() => setManageDialog(true)}><ManageAccounts /></IconButton>
                    </Tooltip>
                    <Button variant="outlined" startIcon={<FileUpload />} onClick={() => fileRef.current?.click()}>
                        Importovať CSV / XML
                    </Button>
                    <input ref={fileRef} type="file" accept=".csv,.txt,.xml" hidden onChange={handleFile} />
                    <Button variant="outlined" color="secondary" startIcon={<AutoAwesome />}
                        onClick={() => setAutoSuggestions(buildSuggestions(transactions, invoices))}>
                        Auto-priradiť
                    </Button>
                    <Button variant="contained" startIcon={<Add />} onClick={() => setShowForm(s => !s)}>
                        Pridať pohyb
                    </Button>
                </Stack>
            </Stack>

            {accounts.length > 0 && (
                <Tabs
                    value={activeAccountId ?? "all"}
                    onChange={(_, v) => setActiveAccountId(v === "all" ? null : v)}
                    variant="scrollable" scrollButtons="auto"
                >
                    <Tab value="all" label="Všetky účty" />
                    {accounts.map(a => (
                        <Tab key={a.id} value={a.id} label={a.iban ? `${a.name} · ${a.iban}` : a.name} />
                    ))}
                </Tabs>
            )}

            {displayed.length > 0 && <SummaryChips income={income} expense={expense} currency={currency} />}

            {showForm && <BankTransactionForm onAdd={() => { setShowForm(false); load(); }} accounts={accounts} bankAccountId={activeAccountId} />}

            <TextField
                size="small" placeholder="Hľadať v pohyboch (popis, protistrana, VS, poznámka)..."
                value={search} onChange={e => setSearch(e.target.value)}
                sx={{ maxWidth: 480 }}
            />

            {displayed.length === 0 ? (
                <Typography color="text.secondary">Žiadne pohyby. Pridajte ich manuálne alebo importujte CSV / XML.</Typography>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: "action.hover" }}>
                                <TableCell>Dátum</TableCell>
                                <TableCell>Popis / Protistrana</TableCell>
                                <TableCell>VS</TableCell>
                                <TableCell align="right">Suma</TableCell>
                                <TableCell>Faktúra</TableCell>
                                <TableCell>Pokladňa</TableCell>
                                <TableCell>Poznámka</TableCell>
                                <TableCell padding="checkbox" />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {displayed.map(tx => {
                                const linkedInv = tx.linkedInvoiceId ? invoices.find(i => i.id === tx.linkedInvoiceId) : undefined;
                                return (
                                    <TableRow key={tx.id} hover>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(tx.date)}</TableCell>
                                        <TableCell>
                                            <Stack>
                                                {tx.description && <Typography variant="body2">{tx.description}</Typography>}
                                                {tx.counterpartyName && <Typography variant="caption" color="text.secondary">{tx.counterpartyName}</Typography>}
                                                {tx.counterpartyIban && <Typography variant="caption" color="text.secondary" fontFamily="monospace">{tx.counterpartyIban}</Typography>}
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            {[tx.variableSymbol && `VS: ${tx.variableSymbol}`, tx.constantSymbol && `KS: ${tx.constantSymbol}`, tx.specificSymbol && `ŠS: ${tx.specificSymbol}`].filter(Boolean).join(" | ")}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                            <Typography fontWeight={600} color={tx.amount >= 0 ? "success.main" : "error.main"}>
                                                {tx.amount >= 0 ? "+" : ""}{fmtCurrency(tx.amount, tx.currency)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                            {linkedInv
                                                ? <LinkedInvoiceChip invoice={linkedInv} onUnlink={() => handleUnlink(tx.id)} showAmount />
                                                : <UnlinkedInvoiceButton onLink={() => setLinkTarget(tx)} />
                                            }
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                            {tx.pairedCashEntryId ? (() => {
                                                const entry = cashEntries.find(e => e.id === tx.pairedCashEntryId);
                                                const reg = entry?.cashRegisterId ? cashRegisters.find(r => r.id === entry.cashRegisterId) : undefined;
                                                return (
                                                    <Stack direction="row" alignItems="center" gap={0.5}>
                                                        <Chip
                                                            icon={<LocalAtm sx={{ fontSize: 14 }} />}
                                                            label={reg ? reg.name : (entry ? entry.date.slice(0, 10) : `#${tx.pairedCashEntryId}`)}
                                                            size="small"
                                                            color="info"
                                                            variant="outlined"
                                                            title={entry ? `${entry.date.slice(0, 10)} · ${entry.amount >= 0 ? "+" : ""}${entry.amount} ${entry.currency}` : ""}
                                                        />
                                                        <Tooltip title="Odpojiť od pokladne">
                                                            <IconButton size="small" onClick={async () => {
                                                                await window.api.cashEntry.pairBankTransaction(activeConfigId!, tx.pairedCashEntryId!, null);
                                                                setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, pairedCashEntryId: undefined } : t));
                                                                setCashEntries(prev => prev.map(e => e.id === tx.pairedCashEntryId ? { ...e, pairedBankTransactionId: undefined } : e));
                                                            }}>
                                                                <LinkOff sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Stack>
                                                );
                                            })() : null}
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 220 }}>
                                            {tx.note && <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ whiteSpace: "pre-wrap" }}>{tx.note}</Typography>}
                                        </TableCell>
                                        <TableCell padding="none" sx={{ whiteSpace: "nowrap" }}>
                                            <Tooltip title={tx.note ? "Upraviť poznámku" : "Pridať poznámku"}>
                                                <IconButton size="small" color={tx.note ? "primary" : "default"} onClick={e => { setNoteTarget({ id: tx.id, note: tx.note ?? "" }); setNoteAnchor(e.currentTarget); }}>
                                                    <EditNote fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Vymazať">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(tx.id)}>
                                                    <DeleteOutline fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <CsvImportDialog open={csvDialog.open} csvRows={csvDialog.rows} accounts={accounts} onClose={() => setCsvDialog(d => ({ ...d, open: false }))} onImport={handleImport} />
            <XmlImportDialog open={xmlDialog.open} rows={xmlDialog.rows} format={xmlDialog.format} accountIban={xmlDialog.accountIban} accounts={accounts} onClose={() => setXmlDialog(d => ({ ...d, open: false }))} onImport={handleImport} />
            <LinkInvoiceDialog open={!!linkTarget} tx={linkTarget} invoices={invoices} onClose={() => setLinkTarget(null)} onLink={(txId, invId) => { handleLink(txId, invId); setLinkTarget(null); }} />
            <AutoMatchDialog open={!!autoSuggestions.length} suggestions={autoSuggestions} onClose={() => setAutoSuggestions([])} onApply={async (sel) => { await handleAutoApply(sel); }} />

            <Popover open={Boolean(noteAnchor)} anchorEl={noteAnchor} onClose={() => setNoteAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
                <Stack sx={{ p: 2, width: 320 }} gap={1.5}>
                    <Typography variant="subtitle2">Poznámka</Typography>
                    <TextField multiline minRows={3} fullWidth autoFocus placeholder="Pridajte poznámku..."
                        value={noteTarget?.note ?? ""}
                        onChange={e => setNoteTarget(p => p ? { ...p, note: e.target.value } : p)}
                        onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) saveNote(); }}
                    />
                    <Stack direction="row" gap={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => setNoteAnchor(null)}>Zrušiť</Button>
                        <Button size="small" variant="contained" onClick={saveNote}>Uložiť</Button>
                    </Stack>
                </Stack>
            </Popover>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={closeSnackbar}>
                <Alert severity={snackbar.severity} onClose={closeSnackbar}>{snackbar.message}</Alert>
            </Snackbar>

            <BankAccountsDialog
                open={manageDialog}
                accounts={accounts}
                companyId={activeCompany?.id ?? 0}
                onClose={() => setManageDialog(false)}
                onChange={() => { loadAccounts(); }}
            />
        </Stack>
    );
};
