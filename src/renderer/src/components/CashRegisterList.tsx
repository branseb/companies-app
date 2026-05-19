import React, { useCallback, useEffect, useState } from "react";
import {
    Alert, Button, Chip, IconButton, Paper, Stack,
    Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import { AccountBalance, Add, DeleteOutline, Edit, LinkOff, LocalAtm, ManageAccounts, Receipt } from "@mui/icons-material";
import { useCompany } from "../context/company";
import { useNavigate } from "react-router-dom";
import type { CashEntry, CashRegister } from "../models/cashEntry";
import { fmt } from "../models/cashEntry";
import type { InvoiceOption, Tx } from "../models/bankTransaction";
import { fmt as fmtBank } from "../models/bankTransaction";
import { toInvoiceOption } from "../utils/bankTransactionParsers";
import { fmtDate } from "../utils/formatters";
import { LinkInvoiceDialog } from "./bankTransaction/InvoiceDialogs";
import { PairBankTxDialog } from "./cash/PairBankTxDialog";
import { EntryForm } from "./cash/EntryForm";
import { ManageDialog } from "./cash/ManageDialog";
import { EditEntryDialog } from "./cash/EditEntryDialog";

export const CashRegisterList: React.FC = () => {
    const { activeCompany, activeConfigId } = useCompany();
    const navigate = useNavigate();
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
    const [editEntry, setEditEntry] = useState<CashEntry | null>(null);

    const load = useCallback(async () => {
        if (!activeCompany?.id) return;
        setEntries(await window.api.cashEntry.byCompany(activeConfigId!, activeCompany.id));
    }, [activeCompany?.id]);

    const loadRegisters = useCallback(async () => {
        if (!activeCompany?.id) return;
        setRegisters(await window.api.cashRegister.byCompany(activeConfigId!, activeCompany.id));
    }, [activeCompany?.id]);

    const loadInvoices = useCallback(async () => {
        if (!activeCompany) return;
        const [issued, received] = await Promise.all([
            window.api.invoice.byCompany(activeConfigId!, activeCompany.ico),
            window.api.invoice.byCustomer(activeConfigId!, activeCompany.ico),
        ]);
        setInvoices([
            ...issued.map((i: any) => toInvoiceOption(i, "issued")),
            ...received.map((i: any) => toInvoiceOption(i, "received")),
        ]);
    }, [activeCompany]);

    const loadBankTransactions = useCallback(async () => {
        if (!activeCompany?.id) return;
        setBankTransactions(await window.api.bankTransaction.byCompany(activeConfigId!, activeCompany.id));
    }, [activeCompany?.id]);

    useEffect(() => { load(); loadRegisters(); loadInvoices(); loadBankTransactions(); }, [load, loadRegisters, loadInvoices, loadBankTransactions]);

    const handleDelete = async (id: number) => {
        await window.api.cashEntry.delete(activeConfigId!, id);
        load();
    };

    const handleLink = async (entryId: number, invoiceId: number) => {
        await window.api.cashEntry.linkInvoice(activeConfigId!, entryId, invoiceId);
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, linkedInvoiceId: invoiceId } : e));
        setLinkTarget(null);
    };

    const handleUnlink = async (entryId: number) => {
        await window.api.cashEntry.linkInvoice(activeConfigId!, entryId, null);
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, linkedInvoiceId: undefined } : e));
    };

    const handlePair = async (cashEntryId: number, bankTxId: number) => {
        await window.api.cashEntry.pairBankTransaction(activeConfigId!, cashEntryId, bankTxId);
        setEntries(prev => prev.map(e => e.id === cashEntryId ? { ...e, pairedBankTransactionId: bankTxId } : e));
        setBankTransactions(prev => prev.map(t => t.id === bankTxId ? { ...t, pairedCashEntryId: cashEntryId } : t));
        setPairTarget(null);
    };

    const handleUnpair = async (cashEntryId: number, bankTxId: number) => {
        await window.api.cashEntry.pairBankTransaction(activeConfigId!, cashEntryId, null);
        setEntries(prev => prev.map(e => e.id === cashEntryId ? { ...e, pairedBankTransactionId: undefined } : e));
        setBankTransactions(prev => prev.map(t => t.id === bankTxId ? { ...t, pairedCashEntryId: undefined } : t));
    };

    const byRegister = activeRegisterId === null ? entries : entries.filter(e => e.cashRegisterId === activeRegisterId);
    const q = search.toLowerCase();
    const displayed = q
        ? byRegister.filter(e => e.description?.toLowerCase().includes(q) || e.note?.toLowerCase().includes(q))
        : byRegister;

    const income = displayed.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const expense = displayed.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    const currency = displayed[0]?.currency ?? registers.find(r => r.id === activeRegisterId)?.currency ?? "EUR";
    const balance = income + expense;

    return (
        <Stack gap={3}>
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

            {registers.length > 0 && (
                <TextField
                    size="small" placeholder="Hľadať v dokladoch (popis, poznámka)..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    sx={{ maxWidth: 480 }}
                />
            )}

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
                                return (
                                    <TableRow key={entry.id} hover>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(entry.date)}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={entry.amount >= 0 ? "Príjem" : "Výdaj"}
                                                size="small"
                                                color={entry.amount >= 0 ? "success" : "error"}
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">{entry.description ?? "—"}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 200 }}>
                                            {entry.note && (
                                                <Typography variant="body2" color="text.secondary" fontStyle="italic">{entry.note}</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                            <Typography fontWeight={600} color={entry.amount >= 0 ? "success.main" : "error.main"}>
                                                {entry.amount >= 0 ? "+" : ""}{fmt(entry.amount, entry.currency)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                            {linkedInv ? (
                                                <Stack direction="row" alignItems="center" gap={0.5}>
                                                    <Chip
                                                        icon={<Receipt sx={{ fontSize: 14 }} />}
                                                        label={linkedInv.invoiceNumber}
                                                        size="small"
                                                        color={linkedInv.type === "issued" ? "primary" : "warning"}
                                                        variant="outlined"
                                                        onClick={() => navigate(`/${activeConfigId}/invoices/${linkedInv.type}`, { state: { highlightId: linkedInv.id } })}
                                                        title={linkedInv.partyName}
                                                        sx={{ cursor: "pointer" }}
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
                                            <Tooltip title="Upraviť">
                                                <IconButton size="small" onClick={() => setEditEntry({ ...entry })}><Edit fontSize="small" /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Vymazať">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(entry.id)}><DeleteOutline fontSize="small" /></IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

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

            <EditEntryDialog
                entry={editEntry}
                onClose={() => setEditEntry(null)}
                onSaved={() => { setEditEntry(null); load(); }}
            />

            <ManageDialog
                open={manageDialog}
                registers={registers}
                companyId={activeCompany?.id ?? 0}
                onClose={() => { setManageDialog(false); setManageOpenedForAdd(false); }}
                onChange={async () => {
                    const wasEmpty = registers.length === 0;
                    const regs: CashRegister[] = await window.api.cashRegister.byCompany(activeConfigId!, activeCompany!.id!);
                    setRegisters(regs);
                    if (manageOpenedForAdd && wasEmpty && regs.length > 0) {
                        setManageDialog(false);
                        setManageOpenedForAdd(false);
                        setShowForm(true);
                    }
                }}
            />

        </Stack>
    );
};
