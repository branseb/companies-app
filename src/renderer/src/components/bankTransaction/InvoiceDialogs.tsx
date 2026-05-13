import React, { useState } from "react";
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import type { InvoiceOption, MatchSuggestion, Tx } from "../../models/bankTransaction";
import { fmt } from "../../models/bankTransaction";

const fmtDate = (d: string) => {
    if (!d) return "—";
    const [y, m, day] = d.slice(0, 10).split("-");
    return y && m && day ? `${parseInt(day)}. ${parseInt(m)}. ${y}` : d;
};

// ─── Manual link dialog ───────────────────────────────────────────────────────

interface LinkDialogProps {
    open: boolean;
    tx: Tx | null;
    invoices: InvoiceOption[];
    onClose: () => void;
    onLink: (txId: number, invoiceId: number) => void;
}

export const LinkInvoiceDialog: React.FC<LinkDialogProps> = ({ open, tx, invoices, onClose, onLink }) => {
    const [search, setSearch] = useState("");

    const filtered = invoices.filter(inv => {
        const q = search.toLowerCase();
        return !q || inv.invoiceNumber.toLowerCase().includes(q) || inv.partyName.toLowerCase().includes(q);
    });

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Priradiť faktúru k platbe</DialogTitle>
            <DialogContent dividers>
                <Stack gap={2}>
                    <TextField
                        autoFocus size="small" fullWidth
                        placeholder="Hľadať podľa čísla faktúry alebo protistrany..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: "grey.50" }}>
                                <TableCell>Číslo</TableCell>
                                <TableCell>Typ</TableCell>
                                <TableCell>Protistrana</TableCell>
                                <TableCell>Dátum</TableCell>
                                <TableCell align="right">Suma</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.map(inv => (
                                <TableRow
                                    key={inv.id} hover
                                    selected={tx?.linkedInvoiceId === inv.id}
                                    onClick={() => tx && onLink(tx.id, inv.id)}
                                    sx={{ cursor: "pointer" }}
                                >
                                    <TableCell>{inv.invoiceNumber}</TableCell>
                                    <TableCell>
                                        <Chip size="small" label={inv.type === "issued" ? "Vydaná" : "Prijatá"} color={inv.type === "issued" ? "primary" : "warning"} variant="outlined" />
                                    </TableCell>
                                    <TableCell>{inv.partyName}</TableCell>
                                    <TableCell>{fmtDate(inv.issueDate)}</TableCell>
                                    <TableCell align="right">{fmt(inv.grossTotal, inv.currency)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zrušiť</Button>
            </DialogActions>
        </Dialog>
    );
};

// ─── Auto-match dialog ────────────────────────────────────────────────────────

interface AutoMatchDialogProps {
    open: boolean;
    suggestions: MatchSuggestion[];
    onClose: () => void;
    onApply: (selected: MatchSuggestion[]) => void;
}

export const AutoMatchDialog: React.FC<AutoMatchDialogProps> = ({ open, suggestions, onClose, onApply }) => {
    const [selected, setSelected] = useState<Set<number>>(
        () => new Set(suggestions.filter(s => s.score >= 100).map(s => s.tx.id))
    );

    const toggle = (txId: number) => setSelected(prev => {
        const next = new Set(prev);
        next.has(txId) ? next.delete(txId) : next.add(txId);
        return next;
    });

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Auto-priradenie faktúr</DialogTitle>
            <DialogContent dividers>
                {!suggestions.length ? (
                    <Alert severity="info">Nenašli sa žiadne zhody. Skontrolujte, či faktúry majú správne čísla a VS.</Alert>
                ) : (
                    <Stack gap={1}>
                        <Alert severity="info">
                            Zaškrtnuté návrhy (skóre ≥ 100) budú priradené automaticky. Ostatné môžete schváliť ručne.
                        </Alert>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: "grey.50" }}>
                                    <TableCell padding="checkbox" />
                                    <TableCell>Platba</TableCell>
                                    <TableCell>Faktúra</TableCell>
                                    <TableCell align="right">Suma platby</TableCell>
                                    <TableCell align="right">Suma faktúry</TableCell>
                                    <TableCell>Dôvod zhody</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {suggestions.map(s => (
                                    <TableRow
                                        key={s.tx.id} hover
                                        onClick={() => toggle(s.tx.id)}
                                        sx={{ cursor: "pointer", bgcolor: selected.has(s.tx.id) ? "action.selected" : undefined }}
                                    >
                                        <TableCell padding="checkbox">
                                            <input type="checkbox" checked={selected.has(s.tx.id)} readOnly />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">{fmtDate(s.tx.date)}</Typography>
                                            <Typography variant="caption" color="text.secondary">{s.tx.description ?? s.tx.counterpartyName ?? "—"}</Typography>
                                            {s.tx.variableSymbol && <Typography variant="caption" color="text.secondary" display="block">VS: {s.tx.variableSymbol}</Typography>}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">{s.invoice.invoiceNumber}</Typography>
                                            <Typography variant="caption" color="text.secondary">{s.invoice.partyName}</Typography>
                                            <Chip size="small" label={s.invoice.type === "issued" ? "Vydaná" : "Prijatá"} color={s.invoice.type === "issued" ? "primary" : "warning"} variant="outlined" sx={{ ml: 0.5, height: 16, fontSize: 10 }} />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography fontWeight={600} color={s.tx.amount >= 0 ? "success.main" : "error.main"}>
                                                {fmt(s.tx.amount, s.tx.currency)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">{fmt(s.invoice.grossTotal, s.invoice.currency)}</TableCell>
                                        <TableCell>
                                            <Stack gap={0.3}>
                                                {s.reasons.map((r, i) => <Typography key={i} variant="caption" color="text.secondary">• {r}</Typography>)}
                                                <Chip size="small" label={`Skóre: ${s.score}`} color={s.score >= 100 ? "success" : "warning"} variant="outlined" sx={{ height: 16, fontSize: 10, width: "fit-content" }} />
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zrušiť</Button>
                {suggestions.length > 0 && (
                    <Button variant="contained" disabled={!selected.size} onClick={() => onApply(suggestions.filter(s => selected.has(s.tx.id)))}>
                        Priradiť vybrané ({selected.size})
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};
