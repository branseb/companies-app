import React, { useState } from "react";
import {
    Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { AccountBalance } from "@mui/icons-material";
import type { CashEntry } from "../../models/cashEntry";
import type { Tx } from "../../models/bankTransaction";
import { fmt as fmtBank } from "../../models/bankTransaction";
import { fmt as fmtCash } from "../../models/cashEntry";

const fmtDate = (d: string) => {
    if (!d) return "—";
    const [y, m, day] = d.slice(0, 10).split("-");
    return y && m && day ? `${parseInt(day)}. ${parseInt(m)}. ${y}` : d;
};

interface Props {
    open: boolean;
    cashEntry: CashEntry | null;
    bankTransactions: Tx[];
    onClose: () => void;
    onPair: (cashEntryId: number, bankTxId: number) => void;
}

export const PairBankTxDialog: React.FC<Props> = ({ open, cashEntry, bankTransactions, onClose, onPair }) => {
    const [search, setSearch] = useState("");

    if (!cashEntry) return null;

    // Show unpaired transactions first, but allow pairing any
    const q = search.toLowerCase();
    const filtered = bankTransactions.filter(tx => {
        if (q) {
            return (
                tx.description?.toLowerCase().includes(q) ||
                tx.counterpartyName?.toLowerCase().includes(q) ||
                tx.variableSymbol?.toLowerCase().includes(q) ||
                fmtDate(tx.date).includes(q)
            );
        }
        return true;
    });

    // Sort: unpaired first, then by date desc
    const sorted = [...filtered].sort((a, b) => {
        if (!!a.pairedCashEntryId !== !!b.pairedCashEntryId) return a.pairedCashEntryId ? 1 : -1;
        return b.date.localeCompare(a.date);
    });

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Stack gap={0.5}>
                    <Typography variant="h6">Spárovať s bankovým pohybom</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Pokladničný doklad: {fmtDate(cashEntry.date)} · <strong>{cashEntry.amount >= 0 ? "+" : ""}{fmtCash(cashEntry.amount, cashEntry.currency)}</strong>
                        {cashEntry.description && ` · ${cashEntry.description}`}
                    </Typography>
                </Stack>
            </DialogTitle>
            <DialogContent dividers>
                <Stack gap={2}>
                    <TextField
                        autoFocus size="small" fullWidth
                        placeholder="Hľadať pohyb (popis, protistrana, VS, dátum)..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {sorted.length === 0 ? (
                        <Typography color="text.secondary">Žiadne bankové pohyby.</Typography>
                    ) : (
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: "grey.50" }}>
                                    <TableCell>Dátum</TableCell>
                                    <TableCell>Popis / Protistrana</TableCell>
                                    <TableCell>VS</TableCell>
                                    <TableCell align="right">Suma</TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sorted.map(tx => (
                                    <TableRow
                                        key={tx.id}
                                        hover
                                        selected={tx.pairedCashEntryId === cashEntry.id}
                                        onClick={() => cashEntry && onPair(cashEntry.id, tx.id)}
                                        sx={{ cursor: "pointer", opacity: tx.pairedCashEntryId && tx.pairedCashEntryId !== cashEntry.id ? 0.45 : 1 }}
                                    >
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(tx.date)}</TableCell>
                                        <TableCell>
                                            <Stack>
                                                {tx.description && <Typography variant="body2">{tx.description}</Typography>}
                                                {tx.counterpartyName && <Typography variant="caption" color="text.secondary">{tx.counterpartyName}</Typography>}
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            {tx.variableSymbol && <Typography variant="caption">VS: {tx.variableSymbol}</Typography>}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                            <Typography fontWeight={600} color={tx.amount >= 0 ? "success.main" : "error.main"}>
                                                {tx.amount >= 0 ? "+" : ""}{fmtBank(tx.amount, tx.currency)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            {tx.pairedCashEntryId === cashEntry.id && (
                                                <Chip icon={<AccountBalance sx={{ fontSize: 14 }} />} label="Spárované" size="small" color="primary" variant="outlined" />
                                            )}
                                            {tx.pairedCashEntryId && tx.pairedCashEntryId !== cashEntry.id && (
                                                <Chip label="Iná pokladňa" size="small" variant="outlined" />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zavrieť</Button>
            </DialogActions>
        </Dialog>
    );
};
