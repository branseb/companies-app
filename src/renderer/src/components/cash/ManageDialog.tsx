import React, { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Select, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { Add, DeleteOutline, Edit } from "@mui/icons-material";
import { useCompany } from "../../context/company";
import type { CashRegister } from "../../models/cashEntry";

type ManageDialogProps = {
    open: boolean;
    registers: CashRegister[];
    companyId: number;
    onClose: () => void;
    onChange: () => void;
}

export const ManageDialog: React.FC<ManageDialogProps> = ({ open, registers, companyId, onClose, onChange }) => {
    const { activeConfigId } = useCompany();
    const [name, setName] = useState("");
    const [currency, setCurrency] = useState("EUR");
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");

    const handleCreate = async () => {
        if (!name.trim()) return;
        await window.api.cashRegister.create(activeConfigId!, { name: name.trim(), currency, companyId });
        setName("");
        onChange();
    };

    const handleUpdate = async (id: number) => {
        await window.api.cashRegister.update(activeConfigId!, { id, name: editName.trim() });
        setEditId(null);
        onChange();
    };

    const handleDelete = async (id: number) => {
        await window.api.cashRegister.delete(activeConfigId!, id);
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
                                    <Typography sx={{ flex: 1 }}>
                                        {r.name}{" "}
                                        <Typography component="span" variant="caption" color="text.secondary">({r.currency})</Typography>
                                    </Typography>
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
