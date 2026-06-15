import React, { useState } from "react";
import {
    Alert, Button, Grid, MenuItem, Paper, Select, Snackbar,
    TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { useSnackbar } from "../hooks/useSnackbar";
import { CurrencySelect } from "./currencySelect";
import { FormSection } from "./FormSection";
import { useCompany } from "../context/company";
import type { BankAccount } from "../models/bankTransaction";
import { today } from "@e-companies/shared";

type FormData = {
    date: string;
    absAmount: string;
    type: "credit" | "debit";
    currency: string;
    description: string;
    counterpartyName: string;
    counterpartyIban: string;
    variableSymbol: string;
    constantSymbol: string;
    specificSymbol: string;
    note: string;
}

const empty = (): FormData => ({
    date: today(),
    absAmount: "",
    type: "credit",
    currency: "EUR",
    description: "",
    counterpartyName: "",
    counterpartyIban: "",
    variableSymbol: "",
    constantSymbol: "",
    specificSymbol: "",
    note: "",
});

type Props = {
    onAdd: () => void;
    accounts?: BankAccount[];
    bankAccountId?: number | null;
}

export const BankTransactionForm: React.FC<Props> = ({ onAdd, accounts = [], bankAccountId = null }) => {
    const { activeCompany, activeConfigId } = useCompany();
    const [form, setForm] = useState<FormData>(empty());
    const [selectedAccountId, setSelectedAccountId] = useState<number | "">(bankAccountId ?? "");
    const { snackbar, showSnackbar, closeSnackbar } = useSnackbar();

    const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({ ...prev, [field]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCompany) return;
        const raw = parseFloat(form.absAmount.replace(",", "."));
        if (isNaN(raw) || raw <= 0) {
            showSnackbar("Zadajte platnú sumu", "error");
            return;
        }
        const amount = form.type === "credit" ? raw : -raw;
        try {
            await window.api.bankTransaction.create(activeConfigId!, {
                date: form.date,
                amount,
                currency: form.currency,
                description: form.description || undefined,
                counterpartyName: form.counterpartyName || undefined,
                counterpartyIban: form.counterpartyIban || undefined,
                variableSymbol: form.variableSymbol || undefined,
                constantSymbol: form.constantSymbol || undefined,
                specificSymbol: form.specificSymbol || undefined,
                note: form.note || undefined,
                companyId: activeCompany.id,
                bankAccountId: selectedAccountId || undefined,
            });
            setForm(empty());
            onAdd();
            showSnackbar("Transakcia uložená");
        } catch {
            showSnackbar("Chyba pri ukladaní", "error");
        }
    };

    return (
        <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h5" gutterBottom>Pridať bankový pohyb</Typography>
            <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>

                    {accounts.length > 0 && (
                        <FormSection title="Bankový účet">
                            <Grid size={{ xs: 12 }}>
                                <Select
                                    fullWidth size="small"
                                    displayEmpty
                                    value={selectedAccountId}
                                    onChange={e => setSelectedAccountId(e.target.value as number | "")}
                                >
                                    <MenuItem value=""><em>— bez účtu —</em></MenuItem>
                                    {accounts.map(a => (
                                        <MenuItem key={a.id} value={a.id}>
                                            {a.name}{a.iban ? ` (${a.iban})` : ""}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </Grid>
                        </FormSection>
                    )}

                    <FormSection title="Pohyb">
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <TextField
                                label="Dátum"
                                type="date"
                                fullWidth
                                required
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={form.date}
                                onChange={set("date")}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <TextField
                                label="Suma"
                                fullWidth
                                required
                                value={form.absAmount}
                                onChange={set("absAmount")}
                                slotProps={{ input: { inputMode: "decimal" } as any }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <CurrencySelect
                                invoice={{ currency: form.currency } as any}
                                onChange={currency => setForm(prev => ({ ...prev, currency }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }} sx={{ display: "flex", alignItems: "center" }}>
                            <ToggleButtonGroup
                                value={form.type}
                                exclusive
                                onChange={(_e, val) => val && setForm(prev => ({ ...prev, type: val }))}
                                size="small"
                                fullWidth
                            >
                                <ToggleButton value="credit" sx={{ color: "success.main", "&.Mui-selected": { bgcolor: "success.light", color: "success.dark" } }}>
                                    Príjem
                                </ToggleButton>
                                <ToggleButton value="debit" sx={{ color: "error.main", "&.Mui-selected": { bgcolor: "error.light", color: "error.dark" } }}>
                                    Výdaj
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label="Popis"
                                fullWidth
                                value={form.description}
                                onChange={set("description")}
                            />
                        </Grid>
                    </FormSection>

                    <FormSection title="Protiúčet">
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Názov protistrany"
                                fullWidth
                                value={form.counterpartyName}
                                onChange={set("counterpartyName")}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="IBAN protistrany"
                                fullWidth
                                value={form.counterpartyIban}
                                onChange={set("counterpartyIban")}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="VS" fullWidth value={form.variableSymbol} onChange={set("variableSymbol")} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="KS" fullWidth value={form.constantSymbol} onChange={set("constantSymbol")} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="ŠS" fullWidth value={form.specificSymbol} onChange={set("specificSymbol")} />
                        </Grid>
                    </FormSection>

                    <FormSection title="Poznámka">
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label="Poznámka"
                                fullWidth
                                multiline
                                minRows={2}
                                value={form.note}
                                onChange={set("note")}
                            />
                        </Grid>
                    </FormSection>

                    <Grid size={{ xs: 12 }}>
                        <Button type="submit" variant="contained">Uložiť pohyb</Button>
                    </Grid>

                </Grid>
            </form>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={closeSnackbar}>
                <Alert severity={snackbar.severity} onClose={closeSnackbar}>{snackbar.message}</Alert>
            </Snackbar>
        </Paper>
    );
};
