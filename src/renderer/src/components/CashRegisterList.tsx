import React, { useCallback, useEffect, useState } from "react";
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, MenuItem, Paper, Select, Snackbar, Stack,
    Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import { AccountBalance, Add, DeleteOutline, Edit, LinkOff, LocalAtm, ManageAccounts, Receipt, SaveOutlined } from "@mui/icons-material";
import { useCompany } from "../context/company";
import type { CashEntry, CashRegister } from "../models/cashEntry";
import { fmt } from "../models/cashEntry";
import type { InvoiceOption, Tx } from "../models/bankTransaction";
import { fmt as fmtBank } from "../models/bankTransaction";
import { toInvoiceOption } from "../utils/bankTransactionParsers";
import { LinkInvoiceDialog } from "./bankTransaction/InvoiceDialogs";
import { PairBankTxDialog } from "./cash/PairBankTxDialog";

const fmtDate = (d: string) => {
    if (!d) return "—";
    const [y, m, day] = d.slice(0, 10).split("-");
    return y && m && day ? `${parseInt(day)}. ${parseInt(m)}. ${y}` : d;
};

const today = () => new Date().toISOString().split("T")[0];

// ── Entry form ────────────────────────────────────────────────────────────────

interface EntryFormProps {
    registers: CashRegister[];
    defaultRegisterId: number | null;
    defaultCurrency: string;
    onAdd: () => void;
}

const EntryForm: React.FC<EntryFormProps> = ({ registers, defaultRegisterId, defaultCurrency, onAdd }) => {
    const { activeCompany } = useCompany();
    const [date, setDate] = useState(today());
    const [amount, setAmount] = useState("");
    const [type, setType] = useState<"income" | "expense">("income");
    const [description, setDescription] = useState("");
    const [registerId, setRegisterId] = useState<number>(
        defaultRegisterId ?? registers[0]?.id ?? 0
    );
    const [saving, setSaving] = useState(false);

    const currency = registers.find(r => r.id === registerId)?.currency ?? defaultCurrency;

    const handleSave = async () => {
        const num = parseFloat(amount.replace(",", "."));
        if (!date || isNaN(num) || num <= 0 || !registerId) return;
        setSaving(true);
        await window.api.cashEntry.create({
            companyId: activeCompany!.id!,
            date,
            amount: type === "income" ? num : -num,
            currency,
            description: description || undefined,
            cashRegisterId: registerId,
        });
        setAmount("");
        setDescription("");
        setSaving(false);
        onAdd();
    };

    return (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction="row" gap={1} flexWrap="wrap" alignItems="flex-end">
                <TextField label="Dátum" type="date" size="small" value={date} onChange={e => setDate(e.target.value)} sx={{ width: 150 }} InputLabelProps={{ shrink: true }} />
                <Select size="small" value={type} onChange={e => setType(e.target.value as "income" | "expense")} sx={{ minWidth: 120 }}>
                    <MenuItem value="income">Príjem</MenuItem>
                    <MenuItem value="expense">Výdaj</MenuItem>
                </Select>
                <TextField label="Suma" size="small" value={amount} onChange={e => setAmount(e.target.value)} sx={{ width: 130 }} placeholder="0,00" />
                <Select size="small" value={registerId} onChange={e => setRegisterId(e.target.value as number)} sx={{ minWidth: 150 }}>
                    {registers.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                </Select>
                <TextField label="Popis" size="small" value={description} onChange={e => setDescription(e.target.value)} sx={{ flex: 1, minWidth: 200 }} />
                <Button variant="contained" startIcon={<SaveOutlined />} onClick={handleSave} disabled={saving || !amount || !registerId}>
                    Uložiť
                </Button>
            </Stack>
        </Paper>
    );
};

// ── Manage registers dialog ───────────────────────────────────────────────────

interface ManageDialogProps {
    open: boolean;
    registers: CashRegister[];
    companyId: number;
    onClose: () => void;
    onChange: () => void;
}

const ManageDialog: React.FC<ManageDialogProps> = ({ open, registers, companyId, onClose, onChange }) => {
    const [name, setName] = useState("");
    const [currency, setCurrency] = useState("EUR");
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");

    const handleCreate = async () => {
        if (!name.trim()) return;
        await window.api.cashRegister.create({ name: name.trim(), currency, companyId });
        setName("");
        onChange();
    };

    const handleUpdate = async (id: number) => {
        await window.api.cashRegister.update({ id, name: editName.trim() });
        setEditId(null);
        onChange();
    };

    const handleDelete = async (id: number) => {
        await window.api.cashRegister.delete(id);
        onChange();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Správa pokladní</DialogTitle>
            <DialogContent>
                <Stack gap={2} mt={1}>
                    <Stack direction="row" gap={1}>
                        <TextField label="Názov pokladne" size="small" value={name} onChange={e => setName(e.target.value)} sx={{ flex: 1 }} />
                        <Select size="small" value={currency} onChange={e => setCurrency(e.target.value)} sx={{ width: 90 }}>
                            {["EUR", "USD", "CZK", "GBP"].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </Select>
                        <Button variant="contained" startIcon={<Add />} onClick={handleCreate} disabled={!name.trim()}>
                            Pridať
                        </Button>
                    </Stack>
                    {registers.map(r => (
                        <Stack key={r.id} direction="row" alignItems="center" gap={1}>
                            {editId === r.id ? (
                                <>
                                    <TextField size="small" value={editName} onChange={e => setEditName(e.target.value)} sx={{ flex: 1 }} autoFocus />
                                    <Button size="small" variant="contained" onClick={() => handleUpdate(r.id)}>Uložiť</Button>
                                    <Button size="small" onClick={() => setEditId(null)}>Zrušiť</Button>
                                </>
                            ) : (
                                <>
                                    <Typography sx={{ flex: 1 }}>{r.name} <Typography component="span" variant="caption" color="text.secondary">({r.currency})</Typography></Typography>
                                    <Tooltip title="Premenovať">
                                        <IconButton size="small" onClick={() => { setEditId(r.id); setEditName(r.name); }}><Edit fontSize="small" /></IconButton>
                                    </Tooltip>
                                    <Tooltip title="Vymazať pokladňu">
                                        <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}><DeleteOutline fontSize="small" /></IconButton>
                                    </Tooltip>
                                </>
                            )}
                        </Stack>
                    ))}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zavrieť</Button>
            </DialogActions>
        </Dialog>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────────

export const CashRegisterList: React.FC = () => {
    const { activeCompany } = useCompany();
    const [entries, setEntries] = useState<CashEntry[]>([]);
    const [registers, setRegisters] = useState<CashRegister[]>([]);
    const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
    const [bankTransactions, setBankTransactions] = useState<Tx[]>([]);
    const [activeRegisterId, setActiveRegisterId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [manageDialog, setManageDialog] = useState(false);
    const [manageOpenedForAdd, setManageOpenedForAdd] = useState(false);
    const [linkTarget, setLinkTarget] = useState<CashEntry | null>(null);
    const [pairTarget, setPairTarget] = useState<CashEntry | null>(null);
    const [search, setSearch] = useState("");
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

    const [editEntry, setEditEntry] = useState<CashEntry | null>(null);

    const load = useCallback(async () => {
        if (!activeCompany?.id) return;
        setEntries(await window.api.cashEntry.byCompany(activeCompany.id));
    }, [activeCompany?.id]);

    const loadRegisters = useCallback(async () => {
        if (!activeCompany?.id) return;
        setRegisters(await window.api.cashRegister.byCompany(activeCompany.id));
    }, [activeCompany?.id]);

    const loadInvoices = useCallback(async () => {
        if (!activeCompany) return;
        const [issued, received] = await Promise.all([
            window.api.invoice.byCompany(activeCompany.ico),
            window.api.invoice.byCustomer(activeCompany.ico),
        ]);
        setInvoices([
            ...issued.map((i: any) => toInvoiceOption(i, "issued")),
            ...received.map((i: any) => toInvoiceOption(i, "received")),
        ]);
    }, [activeCompany]);

    const loadBankTransactions = useCallback(async () => {
        if (!activeCompany?.id) return;
        setBankTransactions(await window.api.bankTransaction.byCompany(activeCompany.id));
    }, [activeCompany?.id]);

    useEffect(() => { load(); loadRegisters(); loadInvoices(); loadBankTransactions(); }, [load, loadRegisters, loadInvoices, loadBankTransactions]);

    const handleDelete = async (id: number) => {
        await window.api.cashEntry.delete(id);
        load();
    };

    const handleLink = async (entryId: number, invoiceId: number) => {
        await window.api.cashEntry.linkInvoice(entryId, invoiceId);
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, linkedInvoiceId: invoiceId } : e));
        setLinkTarget(null);
    };

    const handleUnlink = async (entryId: number) => {
        await window.api.cashEntry.linkInvoice(entryId, null);
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, linkedInvoiceId: undefined } : e));
    };

    const handlePair = async (cashEntryId: number, bankTxId: number) => {
        await window.api.cashEntry.pairBankTransaction(cashEntryId, bankTxId);
        setEntries(prev => prev.map(e => e.id === cashEntryId ? { ...e, pairedBankTransactionId: bankTxId } : e));
        setBankTransactions(prev => prev.map(t => t.id === bankTxId ? { ...t, pairedCashEntryId: cashEntryId } : t));
        setPairTarget(null);
    };

    const handleUnpair = async (cashEntryId: number, bankTxId: number) => {
        await window.api.cashEntry.pairBankTransaction(cashEntryId, null);
        setEntries(prev => prev.map(e => e.id === cashEntryId ? { ...e, pairedBankTransactionId: undefined } : e));
        setBankTransactions(prev => prev.map(t => t.id === bankTxId ? { ...t, pairedCashEntryId: undefined } : t));
    };

    const handleEditSave = async () => {
        if (!editEntry) return;
        await window.api.cashEntry.update({ id: editEntry.id, date: editEntry.date, amount: editEntry.amount, description: editEntry.description, note: editEntry.note });
        setEditEntry(null);
        load();
    };

    const byRegister = activeRegisterId === null
        ? entries
        : entries.filter(e => e.cashRegisterId === activeRegisterId);

    const q = search.toLowerCase();
    const displayed = q
        ? byRegister.filter(e => e.description?.toLowerCase().includes(q) || e.note?.toLowerCase().includes(q))
        : byRegister;

    const income  = displayed.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const expense = displayed.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    const currency = displayed[0]?.currency ?? registers.find(r => r.id === activeRegisterId)?.currency ?? "EUR";

    // per-register balance for the active tab header
    const balance = income + expense;

    return (
        <Stack gap={3}>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Typography variant="h5" fontWeight={700}>Pokladňa</Typography>
                <Stack direction="row" gap={1}>
                    <Tooltip title="Spravovať pokladne">
                        <IconButton onClick={() => setManageDialog(true)}><ManageAccounts /></IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => {
                            if (registers.length === 0) { setManageOpenedForAdd(true); setManageDialog(true); }
                            else setShowForm(s => !s);
                        }}
                    >
                        Pridať doklad
                    </Button>
                </Stack>
            </Stack>

            {/* Register tabs */}
            {registers.length > 0 && (
                <Tabs
                    value={activeRegisterId ?? "all"}
                    onChange={(_, v) => setActiveRegisterId(v === "all" ? null : v)}
                    variant="scrollable" scrollButtons="auto"
                >
                    <Tab value="all" label="Všetky pokladne" />
                    {registers.map(r => <Tab key={r.id} value={r.id} label={r.name} />)}
                </Tabs>
            )}

            {/* Summary */}
            {displayed.length > 0 && (
                <Stack direction="row" gap={1} flexWrap="wrap">
                    <Chip label={`Príjmy: ${fmt(income, currency)}`} color="success" variant="outlined" />
                    <Chip label={`Výdaje: ${fmt(expense, currency)}`} color="error" variant="outlined" />
                    <Chip label={`Zostatok: ${fmt(balance, currency)}`} color={balance >= 0 ? "primary" : "error"} icon={<LocalAtm />} />
                </Stack>
            )}

            {showForm && (
                <EntryForm
                    registers={registers}
                    defaultRegisterId={activeRegisterId}
                    defaultCurrency={registers.find(r => r.id === activeRegisterId)?.currency ?? "EUR"}
                    onAdd={() => { setShowForm(false); load(); }}
                />
            )}

            {/* Search */}
            {registers.length > 0 && (
                <TextField
                    size="small" placeholder="Hľadať v dokladoch (popis, poznámka)..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    sx={{ maxWidth: 480 }}
                />
            )}

            {/* Table */}
            {registers.length === 0 ? (
                <Alert severity="info">
                    Najprv vytvorte pokladňu — kliknite na <strong>Pridať doklad</strong> alebo ikonu nastavení vpravo hore.
                </Alert>
            ) : displayed.length === 0 ? (
                <Typography color="text.secondary">Žiadne doklady. Pridajte prvý pokladničný doklad.</Typography>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: "grey.50" }}>
                                <TableCell>Dátum</TableCell>
                                <TableCell>Typ</TableCell>
                                <TableCell>Popis</TableCell>
                                <TableCell>Poznámka</TableCell>
                                <TableCell align="right">Suma</TableCell>
                                <TableCell>Faktúra</TableCell>
                                <TableCell>Bankový pohyb</TableCell>
                                {registers.length > 0 && <TableCell>Pokladňa</TableCell>}
                                <TableCell padding="checkbox" />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {displayed.map(entry => {
                                const reg = registers.find(r => r.id === entry.cashRegisterId);
                                const linkedInv = entry.linkedInvoiceId ? invoices.find(i => i.id === entry.linkedInvoiceId) : undefined;
                                const isEditing = editEntry?.id === entry.id;
                                return (
                                    <TableRow key={entry.id} hover>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                            {isEditing ? (
                                                <TextField
                                                    type="date" size="small" value={editEntry.date}
                                                    onChange={e => setEditEntry(p => p ? { ...p, date: e.target.value } : p)}
                                                    sx={{ width: 145 }}
                                                    InputLabelProps={{ shrink: true }}
                                                />
                                            ) : fmtDate(entry.date)}
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <Select
                                                    size="small"
                                                    value={editEntry.amount >= 0 ? "income" : "expense"}
                                                    onChange={e => setEditEntry(p => p ? { ...p, amount: e.target.value === "income" ? Math.abs(p.amount) : -Math.abs(p.amount) } : p)}
                                                    sx={{ minWidth: 110 }}
                                                >
                                                    <MenuItem value="income">Príjem</MenuItem>
                                                    <MenuItem value="expense">Výdaj</MenuItem>
                                                </Select>
                                            ) : (
                                                <Chip
                                                    label={entry.amount >= 0 ? "Príjem" : "Výdaj"}
                                                    size="small"
                                                    color={entry.amount >= 0 ? "success" : "error"}
                                                    variant="outlined"
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <TextField
                                                    size="small" value={editEntry.description ?? ""} autoFocus
                                                    onChange={e => setEditEntry(p => p ? { ...p, description: e.target.value } : p)}
                                                    sx={{ minWidth: 200 }}
                                                />
                                            ) : (
                                                <Typography variant="body2">{entry.description ?? "—"}</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 200 }}>
                                            {isEditing ? (
                                                <TextField
                                                    size="small" value={editEntry.note ?? ""} multiline
                                                    onChange={e => setEditEntry(p => p ? { ...p, note: e.target.value } : p)}
                                                    sx={{ minWidth: 200 }}
                                                />
                                            ) : (
                                                entry.note && <Typography variant="body2" color="text.secondary" fontStyle="italic">{entry.note}</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                            {isEditing ? (
                                                <TextField
                                                    size="small"
                                                    value={Math.abs(editEntry.amount)}
                                                    onChange={e => {
                                                        const num = parseFloat(e.target.value.replace(",", "."));
                                                        if (!isNaN(num)) setEditEntry(p => p ? { ...p, amount: p.amount >= 0 ? num : -num } : p);
                                                    }}
                                                    sx={{ width: 110 }}
                                                    inputProps={{ step: "0.01" }}
                                                    type="number"
                                                />
                                            ) : (
                                                <Typography fontWeight={600} color={entry.amount >= 0 ? "success.main" : "error.main"}>
                                                    {entry.amount >= 0 ? "+" : ""}{fmt(entry.amount, entry.currency)}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        {/* Invoice link */}
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                            {linkedInv ? (
                                                <Stack direction="row" alignItems="center" gap={0.5}>
                                                    <Chip
                                                        icon={<Receipt sx={{ fontSize: 14 }} />}
                                                        label={linkedInv.invoiceNumber}
                                                        size="small"
                                                        color={linkedInv.type === "issued" ? "primary" : "warning"}
                                                        variant="outlined"
                                                        onClick={() => setLinkTarget(entry)}
                                                        title={`${linkedInv.partyName}`}
                                                    />
                                                    <Tooltip title="Odpojiť faktúru">
                                                        <IconButton size="small" onClick={() => handleUnlink(entry.id)}>
                                                            <LinkOff sx={{ fontSize: 14 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            ) : (
                                                <Tooltip title="Priradiť faktúru">
                                                    <IconButton size="small" onClick={() => setLinkTarget(entry)}>
                                                        <Receipt fontSize="small" sx={{ opacity: 0.3 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                        {/* Bank transaction pair */}
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                            {entry.pairedBankTransactionId ? (() => {
                                                const paired = bankTransactions.find(t => t.id === entry.pairedBankTransactionId);
                                                return (
                                                    <Stack direction="row" alignItems="center" gap={0.5}>
                                                        <Chip
                                                            icon={<AccountBalance sx={{ fontSize: 14 }} />}
                                                            label={paired ? `${fmtDate(paired.date)} · ${fmtBank(paired.amount, paired.currency)}` : `#${entry.pairedBankTransactionId}`}
                                                            size="small"
                                                            color="info"
                                                            variant="outlined"
                                                            onClick={() => setPairTarget(entry)}
                                                            title={paired?.description ?? paired?.counterpartyName ?? ""}
                                                        />
                                                        <Tooltip title="Odpojiť bankový pohyb">
                                                            <IconButton size="small" onClick={() => handleUnpair(entry.id, entry.pairedBankTransactionId!)}>
                                                                <LinkOff sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Stack>
                                                );
                                            })() : (
                                                <Tooltip title="Spárovať s bankovým pohybom">
                                                    <IconButton size="small" onClick={() => setPairTarget(entry)}>
                                                        <AccountBalance fontSize="small" sx={{ opacity: 0.3 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                        {registers.length > 0 && (
                                            <TableCell>
                                                {reg && <Chip label={reg.name} size="small" variant="outlined" />}
                                            </TableCell>
                                        )}
                                        <TableCell padding="none" sx={{ whiteSpace: "nowrap" }}>
                                            {isEditing ? (
                                                <>
                                                    <Tooltip title="Uložiť">
                                                        <IconButton size="small" color="primary" onClick={handleEditSave}><SaveOutlined fontSize="small" /></IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Zrušiť">
                                                        <IconButton size="small" onClick={() => setEditEntry(null)}><DeleteOutline fontSize="small" /></IconButton>
                                                    </Tooltip>
                                                </>
                                            ) : (
                                                <>
                                                    <Tooltip title="Upraviť">
                                                        <IconButton size="small" onClick={() => setEditEntry({ ...entry })}><Edit fontSize="small" /></IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Vymazať">
                                                        <IconButton size="small" color="error" onClick={() => handleDelete(entry.id)}><DeleteOutline fontSize="small" /></IconButton>
                                                    </Tooltip>
                                                </>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Link invoice dialog — reuses the bank module dialog, adapted for CashEntry */}
            <LinkInvoiceDialog
                open={!!linkTarget}
                tx={(linkTarget ? {
                    id: linkTarget.id,
                    date: linkTarget.date,
                    amount: linkTarget.amount,
                    currency: linkTarget.currency,
                    description: linkTarget.description,
                    linkedInvoiceId: linkTarget.linkedInvoiceId,
                } : null) as any}
                invoices={invoices}
                onClose={() => setLinkTarget(null)}
                onLink={(entryId, invId) => handleLink(entryId, invId)}
            />

            <PairBankTxDialog
                open={!!pairTarget}
                cashEntry={pairTarget}
                bankTransactions={bankTransactions}
                onClose={() => setPairTarget(null)}
                onPair={(cashEntryId, bankTxId) => handlePair(cashEntryId, bankTxId)}
            />

            <ManageDialog
                open={manageDialog}
                registers={registers}
                companyId={activeCompany?.id ?? 0}
                onClose={() => { setManageDialog(false); setManageOpenedForAdd(false); }}
                onChange={async () => {
                    const wasEmpty = registers.length === 0;
                    const regs: CashRegister[] = await window.api.cashRegister.byCompany(activeCompany!.id!);
                    setRegisters(regs);
                    if (manageOpenedForAdd && wasEmpty && regs.length > 0) {
                        setManageDialog(false);
                        setManageOpenedForAdd(false);
                        setShowForm(true);
                    }
                }}
            />

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
            </Snackbar>
        </Stack>
    );
};
