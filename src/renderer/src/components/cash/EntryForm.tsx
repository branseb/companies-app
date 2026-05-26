import React, { useState } from "react";
import { Button, MenuItem, Paper, Select, Stack, TextField } from "@mui/material";
import { SaveOutlined } from "@mui/icons-material";
import { useCompany } from "../../context/company";
import type { CashRegister } from "../../models/cashEntry";

type EntryFormProps = {
    registers: CashRegister[];
    defaultRegisterId: number | null;
    defaultCurrency: string;
    onAdd: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

export const EntryForm: React.FC<EntryFormProps> = ({ registers, defaultRegisterId, defaultCurrency, onAdd }) => {
    const { activeCompany, activeConfigId } = useCompany();
    const [date, setDate] = useState(today());
    const [amount, setAmount] = useState("");
    const [type, setType] = useState<"income" | "expense">("income");
    const [description, setDescription] = useState("");
    const [registerId, setRegisterId] = useState<number>(defaultRegisterId ?? registers[0]?.id ?? 0);
    const [saving, setSaving] = useState(false);

    const currency = registers.find(r => r.id === registerId)?.currency ?? defaultCurrency;

    const handleSave = async () => {
        const num = parseFloat(amount.replace(",", "."));
        if (!date || isNaN(num) || num <= 0 || !registerId) return;
        setSaving(true);
        await window.api.cashEntry.create(activeConfigId!, {
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
