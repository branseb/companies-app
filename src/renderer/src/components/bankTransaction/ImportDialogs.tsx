import React, { useState } from "react";
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, MenuItem, Select, Stack, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import type { BankAccount, ColMapping, ImportRow } from "../../models/bankTransaction";
import { FIELD_LABELS } from "../../models/bankTransaction";
import { parseAmount, parseDate } from "../../utils/bankTransactionParsers";

const fmtDate = (d: string) => {
    if (!d) return "—";
    const [y, m, day] = d.slice(0, 10).split("-");
    return y && m && day ? `${parseInt(day)}. ${parseInt(m)}. ${y}` : d;
};

// ─── Shared preview ───────────────────────────────────────────────────────────

const PreviewTable: React.FC<{ rows: ImportRow[] }> = ({ rows }) => (
    <TableContainer sx={{ maxHeight: 260 }}>
        <Table size="small" stickyHeader>
            <TableHead>
                <TableRow>
                    <TableCell>Dátum</TableCell>
                    <TableCell>Popis / Protistrana</TableCell>
                    <TableCell>VS</TableCell>
                    <TableCell align="right">Suma</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {rows.slice(0, 15).map((r, i) => (
                    <TableRow key={i}>
                        <TableCell>{fmtDate(r.date)}</TableCell>
                        <TableCell>
                            <Stack>
                                {r.description && <Typography variant="body2">{r.description}</Typography>}
                                {r.counterpartyName && <Typography variant="caption" color="text.secondary">{r.counterpartyName}</Typography>}
                            </Stack>
                        </TableCell>
                        <TableCell>{r.variableSymbol}</TableCell>
                        <TableCell align="right" sx={{ color: (r.amount ?? 0) >= 0 ? "success.main" : "error.main", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {(r.amount ?? 0) >= 0 ? "+" : ""}{r.amount?.toFixed(2)} {r.currency}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </TableContainer>
);

// ─── Account selector ─────────────────────────────────────────────────────────

const AccountSelect: React.FC<{ accounts: BankAccount[]; value: number | ""; onChange: (v: number | "") => void }> = ({ accounts, value, onChange }) => {
    if (!accounts.length) return null;
    return (
        <Box>
            <Typography variant="caption" display="block" gutterBottom>Bankový účet</Typography>
            <Select size="small" value={value} onChange={e => onChange(e.target.value as number | "")} displayEmpty sx={{ minWidth: 260 }}>
                <MenuItem value=""><em>— bez účtu —</em></MenuItem>
                {accounts.map(a => (
                    <MenuItem key={a.id} value={a.id}>{a.name}{a.iban ? ` (${a.iban})` : ""}</MenuItem>
                ))}
            </Select>
        </Box>
    );
};

// ─── XML import dialog ────────────────────────────────────────────────────────

type XmlDialogProps = {
    open: boolean;
    rows: ImportRow[];
    format: string;
    accountIban?: string;
    accounts: BankAccount[];
    onClose: () => void;
    onImport: (rows: ImportRow[], bankAccountId?: number) => void;
}

export const XmlImportDialog: React.FC<XmlDialogProps> = ({ open, rows, format, accountIban, accounts, onClose, onImport }) => {
    const matched = accountIban ? accounts.find(a => a.iban?.replace(/\s/g, "") === accountIban.replace(/\s/g, "")) : undefined;
    const [accountId, setAccountId] = useState<number | "">(matched?.id ?? "");

    // Re-sync when detected account changes
    React.useEffect(() => {
        setAccountId(matched?.id ?? "");
    }, [matched?.id]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Import XML — {format}</DialogTitle>
            <DialogContent dividers>
                <Stack gap={2}>
                    <Alert severity="success">
                        Rozpoznaný formát: <strong>{format}</strong>. Našlo sa <strong>{rows.length}</strong> pohybov.
                        {matched && <> Účet v súbore: <strong>{accountIban}</strong> — zhoduje sa s účtom „<strong>{matched.name}</strong>".</>}
                    </Alert>
                    {accountIban && !matched && (
                        <Alert severity="warning">
                            IBAN v súbore (<strong>{accountIban}</strong>) sa nezhoduje so žiadnym bankový účtom. Vyberte účet manuálne alebo ho najprv vytvorte.
                        </Alert>
                    )}
                    <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
                    <Typography variant="subtitle2">Náhľad (prvých 15)</Typography>
                    <PreviewTable rows={rows} />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zrušiť</Button>
                <Button variant="contained" onClick={() => onImport(rows, accountId || undefined)}>
                    Importovať {rows.length} pohybov
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// ─── CSV import dialog ────────────────────────────────────────────────────────

type CsvDialogProps = {
    open: boolean;
    csvRows: string[][];
    accounts: BankAccount[];
    onClose: () => void;
    onImport: (rows: ImportRow[], bankAccountId?: number) => void;
}

export const CsvImportDialog: React.FC<CsvDialogProps> = ({ open, csvRows, accounts, onClose, onImport }) => {
    const [hasHeader, setHasHeader] = useState(true);
    const [csvCurrency, setCsvCurrency] = useState("EUR");
    const [accountId, setAccountId] = useState<number | "">("");
    const [mapping, setMapping] = useState<ColMapping>(() => {
        if (!csvRows.length) return { date: "", amount: "", creditAmount: "", debitAmount: "", description: "", counterpartyName: "", counterpartyIban: "", variableSymbol: "", constantSymbol: "", specificSymbol: "" };
        const header = csvRows[0].map(h => h.toLowerCase());
        const find = (...terms: string[]) => { const i = header.findIndex(h => terms.some(t => h.includes(t))); return i >= 0 ? i : ("" as const); };
        return {
            date: find("dátum", "datum", "date"),
            amount: find("suma", "amount", "čiastka"),
            creditAmount: find("príjem", "prijem", "credit", "vklad"),
            debitAmount: find("výdaj", "vydaj", "debit", "výber"),
            description: find("popis", "description", "správa", "sprava"),
            counterpartyName: find("protistrana", "partner", "príjemca", "meno"),
            counterpartyIban: find("iban"),
            variableSymbol: find("vs", "variabilný", "variabilny"),
            constantSymbol: find("ks", "konštantný", "konstantny"),
            specificSymbol: find("šs", "ss", "špecifický"),
        };
    });

    const headers = csvRows[0] ?? [];
    const dataRows = hasHeader && csvRows.length > 1 ? csvRows.slice(1) : csvRows;

    const ColSelect = ({ field }: { field: keyof ColMapping }) => (
        <Select size="small" value={mapping[field]} onChange={e => setMapping(p => ({ ...p, [field]: e.target.value }))} displayEmpty sx={{ minWidth: 150 }}>
            <MenuItem value=""><em>— nevybrané —</em></MenuItem>
            {headers.map((h, i) => <MenuItem key={i} value={i}>{h || `Stĺpec ${i + 1}`}</MenuItem>)}
        </Select>
    );

    const buildRows = (): ImportRow[] => dataRows.map(row => {
        const get = (f: keyof ColMapping) => mapping[f] !== "" ? row[mapping[f] as number] ?? "" : "";
        let amount: number | null = null;
        if (mapping.amount !== "") amount = parseAmount(get("amount"));
        else {
            const c = parseAmount(get("creditAmount")) ?? 0;
            const d = parseAmount(get("debitAmount")) ?? 0;
            amount = c - Math.abs(d);
        }
        return {
            date: parseDate(get("date")) ?? get("date"),
            amount: amount ?? 0,
            currency: csvCurrency,
            description: get("description") || undefined,
            counterpartyName: get("counterpartyName") || undefined,
            counterpartyIban: get("counterpartyIban") || undefined,
            variableSymbol: get("variableSymbol") || undefined,
            constantSymbol: get("constantSymbol") || undefined,
            specificSymbol: get("specificSymbol") || undefined,
        };
    }).filter(r => r.date && r.amount !== 0);

    const rows = buildRows();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Import CSV — mapovanie stĺpcov</DialogTitle>
            <DialogContent dividers>
                <Stack gap={2}>
                    <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
                        <Box>
                            <Typography variant="caption" display="block" gutterBottom>Prvý riadok je hlavička?</Typography>
                            <Stack direction="row" gap={1}>
                                <Button size="small" variant={hasHeader ? "contained" : "outlined"} onClick={() => setHasHeader(true)}>Áno</Button>
                                <Button size="small" variant={!hasHeader ? "contained" : "outlined"} onClick={() => setHasHeader(false)}>Nie</Button>
                            </Stack>
                        </Box>
                        <Box>
                            <Typography variant="caption" display="block" gutterBottom>Mena</Typography>
                            <Select size="small" value={csvCurrency} onChange={e => setCsvCurrency(e.target.value)}>
                                {["EUR", "USD", "CZK", "GBP", "CHF", "PLN", "HUF"].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                            </Select>
                        </Box>
                        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
                    </Stack>
                    <Divider />
                    <Typography variant="subtitle2">Priradenie stĺpcov</Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                        {(Object.keys(FIELD_LABELS) as (keyof ColMapping)[]).map(field => (
                            <Stack key={field} direction="row" alignItems="center" gap={1}>
                                <Typography variant="body2" sx={{ minWidth: 110 }}>{FIELD_LABELS[field]}</Typography>
                                <ColSelect field={field} />
                            </Stack>
                        ))}
                    </Box>
                    <Divider />
                    <Typography variant="subtitle2">Náhľad ({rows.length} riadkov)</Typography>
                    <PreviewTable rows={rows} />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zrušiť</Button>
                <Button variant="contained" onClick={() => onImport(rows, accountId || undefined)} disabled={!rows.length}>
                    Importovať {rows.length} pohybov
                </Button>
            </DialogActions>
        </Dialog>
    );
};
