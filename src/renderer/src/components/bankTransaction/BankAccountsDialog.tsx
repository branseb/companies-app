import React, { useState } from "react";
import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, IconButton, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { CheckOutlined, CloseOutlined, DeleteOutline, EditOutlined } from "@mui/icons-material";
import type { BankAccount } from "../../models/bankTransaction";

interface Props {
    open: boolean;
    accounts: BankAccount[];
    companyId: number;
    onClose: () => void;
    onChange: () => void;
}

const CURRENCIES = ["EUR", "USD", "CZK", "GBP", "CHF", "PLN", "HUF"];

const empty = () => ({ name: "", iban: "", currency: "EUR" });

export const BankAccountsDialog: React.FC<Props> = ({ open, accounts, companyId, onClose, onChange }) => {
    const [form, setForm] = useState(empty());
    const [saving, setSaving] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ name: "", note: "" });

    const startEdit = (a: BankAccount) => {
        setEditId(a.id);
        setEditForm({ name: a.name, note: a.note ?? "" });
    };

    const cancelEdit = () => setEditId(null);

    const handleSaveEdit = async () => {
        if (!editForm.name.trim() || editId === null) return;
        await window.api.bankAccount.update({ id: editId, name: editForm.name.trim(), note: editForm.note.trim() || undefined });
        setEditId(null);
        onChange();
    };

    const handleAdd = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            await window.api.bankAccount.create({ name: form.name.trim(), iban: form.iban.trim() || undefined, currency: form.currency, companyId });
            setForm(empty());
            onChange();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        await window.api.bankAccount.delete(id);
        onChange();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Bankové účty</DialogTitle>
            <DialogContent dividers>
                <Stack gap={2}>
                    {accounts.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">Zatiaľ žiadne bankové účty.</Typography>
                    ) : (
                        accounts.map(a => (
                            <Stack key={a.id} gap={1}>
                                {editId === a.id ? (
                                    <Stack gap={1}>
                                        <TextField
                                            label="Názov *" size="small" fullWidth autoFocus
                                            value={editForm.name}
                                            onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                        />
                                        <TextField
                                            label="Poznámka" size="small" fullWidth multiline rows={2}
                                            value={editForm.note}
                                            onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                                        />
                                        <Stack direction="row" gap={1}>
                                            <Button size="small" variant="contained" startIcon={<CheckOutlined />} disabled={!editForm.name.trim()} onClick={handleSaveEdit}>
                                                Uložiť
                                            </Button>
                                            <Button size="small" startIcon={<CloseOutlined />} onClick={cancelEdit}>
                                                Zrušiť
                                            </Button>
                                        </Stack>
                                    </Stack>
                                ) : (
                                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                                        <Stack>
                                            <Typography variant="body2" fontWeight={600}>{a.name}</Typography>
                                            {a.iban && <Typography variant="caption" color="text.secondary" fontFamily="monospace">{a.iban}</Typography>}
                                            <Typography variant="caption" color="text.secondary">{a.currency}</Typography>
                                            {a.note && <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>{a.note}</Typography>}
                                        </Stack>
                                        <Stack direction="row">
                                            <Tooltip title="Upraviť">
                                                <IconButton size="small" onClick={() => startEdit(a)}>
                                                    <EditOutlined fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Odstrániť účet">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(a.id)}>
                                                    <DeleteOutline fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </Stack>
                                )}
                            </Stack>
                        ))
                    )}

                    <Divider />
                    <Typography variant="subtitle2">Pridať nový účet</Typography>
                    <TextField
                        label="Názov *" size="small" fullWidth
                        value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    />
                    <TextField
                        label="IBAN" size="small" fullWidth
                        value={form.iban}
                        onChange={e => setForm(p => ({ ...p, iban: e.target.value }))}
                    />
                    <Select size="small" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                        {CURRENCIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                    <Button variant="contained" disabled={!form.name.trim() || saving} onClick={handleAdd}>
                        Pridať účet
                    </Button>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zavrieť</Button>
            </DialogActions>
        </Dialog>
    );
};
