import React, { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Select, Stack, TextField } from "@mui/material";
import { useCompany } from "../../context/company";
import type { CashEntry } from "../../models/cashEntry";

type EditEntryDialogProps = {
    entry: CashEntry | null;
    onClose: () => void;
    onSaved: () => void;
}

export const EditEntryDialog: React.FC<EditEntryDialogProps> = ({ entry, onClose, onSaved }) => {
    const { activeConfigId } = useCompany();
    const [date, setDate] = useState("");
    const [entryType, setEntryType] = useState<"income" | "expense">("income");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!entry) return;
        setDate(entry.date);
        setEntryType(entry.amount >= 0 ? "income" : "expense");
        setAmount(String(Math.abs(entry.amount)));
        setDescription(entry.description ?? "");
        setNote(entry.note ?? "");
    }, [entry]);

    const handleSave = async () => {
        if (!entry) return;
        const num = parseFloat(amount.replace(",", "."));
        if (!date || isNaN(num) || num <= 0) return;
        setSaving(true);
        await window.api.cashEntry.update(activeConfigId!, {
            id: entry.id,
            date,
            amount: entryType === "income" ? num : -num,
            description: description || undefined,
            note: note || undefined,
        });
        setSaving(false);
        onSaved();
    };

    return (
        <Dialog open={!!entry} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>Upraviť doklad</DialogTitle>
            <DialogContent>
                <Stack gap={2} mt={1}>
                    <TextField label="Dátum" type="date" size="small" fullWidth value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                    <Select size="small" fullWidth value={entryType} onChange={e => setEntryType(e.target.value as "income" | "expense")}>
                        <MenuItem value="income">Príjem</MenuItem>
                        <MenuItem value="expense">Výdaj</MenuItem>
                    </Select>
                    <TextField label="Suma" size="small" fullWidth type="number" value={amount} onChange={e => setAmount(e.target.value)} inputProps={{ step: "0.01", min: "0" }} />
                    <TextField label="Popis" size="small" fullWidth value={description} onChange={e => setDescription(e.target.value)} />
                    <TextField label="Poznámka" size="small" fullWidth multiline rows={2} value={note} onChange={e => setNote(e.target.value)} />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zrušiť</Button>
                <Button variant="contained" onClick={handleSave} disabled={saving || !date || !amount}>Uložiť</Button>
            </DialogActions>
        </Dialog>
    );
};
