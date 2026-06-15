import React from "react";
import {
    Table, TableHead, TableBody, TableRow, TableCell,
    TextField, IconButton, Button, Box, Stack, Typography,
    Select, MenuItem, Autocomplete,
} from "@mui/material";
import { Add, Delete } from "@mui/icons-material";
import type { InvoiceItem } from "../models/SimpleInvoice";
import { TAX_RATES } from "@e-companies/shared";
const UNITS = ["ks", "hod", "deň", "kg", "g", "l", "m", "m²", "m³"];

type Props = {
    items: InvoiceItem[];
    onChange: (items: InvoiceItem[]) => void;
    vatEnabled?: boolean;
    compact?: boolean;
}

export const InvoiceItemsEditor: React.FC<Props> = ({ items, onChange, vatEnabled = true, compact }) => {
    const update = (index: number, field: keyof InvoiceItem, value: string | number) =>
        onChange(items.map((item, i) => i === index ? { ...item, [field]: value } : item));

    const add = () => onChange([...items, { description: "", quantity: 1, unitPrice: 0, taxRate: 20 }]);

    const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

    const total = (item: InvoiceItem) =>
        Math.round(item.quantity * item.unitPrice * (1 + item.taxRate / 100) * 100) / 100;

    const updateTotal = (index: number, totalValue: number) => {
        const item = items[index];
        const divisor = item.quantity * (1 + item.taxRate / 100);
        update(index, "unitPrice", divisor !== 0 ? Math.round(totalValue / divisor * 10000) / 10000 : 0);
    };

    if (compact) {
        return (
            <Stack gap={1}>
                {items.map((item, i) => (
                    <Box key={i} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                        <Stack direction="row" gap={1} alignItems="flex-end" mb={1}>
                            <TextField
                                variant="standard" fullWidth size="small"
                                label="Popis" placeholder="Popis položky"
                                value={item.description}
                                onChange={e => update(i, "description", e.target.value)}
                            />
                            <Autocomplete
                                freeSolo options={UNITS}
                                value={item.unit ?? ""}
                                onInputChange={(_e, val) => update(i, "unit", val)}
                                renderInput={params => (
                                    <TextField {...params} variant="standard" label="Jedn." sx={{ width: 60 }} />
                                )}
                                disableClearable sx={{ flexShrink: 0 }}
                            />
                            <IconButton size="small" color="error" onClick={() => remove(i)} sx={{ mb: 0.5 }}>
                                <Delete fontSize="small" />
                            </IconButton>
                        </Stack>
                        <Stack direction="row" gap={1} alignItems="flex-end">
                            <TextField
                                variant="standard" label="Množstvo" type="number" sx={{ flex: 1 }}
                                slotProps={{ htmlInput: { min: 0, style: { textAlign: 'right' } } }}
                                value={item.quantity}
                                onChange={e => update(i, "quantity", parseFloat(e.target.value) || 0)}
                            />
                            <TextField
                                variant="standard" label="Jedn. cena" type="number" sx={{ flex: 2 }}
                                slotProps={{ htmlInput: { min: 0, step: 0.01, style: { textAlign: 'right' } } }}
                                value={item.unitPrice}
                                onChange={e => update(i, "unitPrice", parseFloat(e.target.value) || 0)}
                            />
                            {vatEnabled && (
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" color="text.secondary">DPH</Typography>
                                    <Select
                                        variant="standard" fullWidth value={item.taxRate}
                                        onChange={e => update(i, "taxRate", Number(e.target.value))}
                                    >
                                        {TAX_RATES.map(r => <MenuItem key={r} value={r}>{r} %</MenuItem>)}
                                    </Select>
                                </Box>
                            )}
                            <TextField
                                variant="standard" label="Spolu" type="number" sx={{ flex: 2 }}
                                slotProps={{ htmlInput: { min: 0, step: 0.01, style: { textAlign: 'right' } } }}
                                value={total(item)}
                                onChange={e => updateTotal(i, parseFloat(e.target.value) || 0)}
                            />
                        </Stack>
                    </Box>
                ))}
                <Button startIcon={<Add />} size="small" onClick={add} sx={{ alignSelf: 'flex-start' }}>
                    Pridať položku
                </Button>
            </Stack>
        );
    }

    return (
        <Box>
            <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 560 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell>Popis</TableCell>
                            <TableCell sx={{ width: 80 }}>Jedn.</TableCell>
                            <TableCell align="right" sx={{ width: 80 }}>Množstvo</TableCell>
                            <TableCell align="right" sx={{ width: 110 }}>Jedn. cena</TableCell>
                            {vatEnabled && <TableCell align="right" sx={{ width: 90 }}>DPH %</TableCell>}
                            <TableCell align="right" sx={{ width: 100 }}>Spolu</TableCell>
                            <TableCell padding="checkbox" />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map((item, i) => (
                            <TableRow key={i}>
                                <TableCell>
                                    <TextField variant="standard" fullWidth value={item.description}
                                        onChange={e => update(i, "description", e.target.value)}
                                        placeholder="Popis položky" />
                                </TableCell>
                                <TableCell>
                                    <Autocomplete freeSolo options={UNITS} value={item.unit ?? ""}
                                        onInputChange={(_e, val) => update(i, "unit", val)}
                                        renderInput={params => <TextField {...params} variant="standard" placeholder="ks" />}
                                        disableClearable sx={{ width: 70 }} />
                                </TableCell>
                                <TableCell>
                                    <TextField variant="standard" type="number"
                                        slotProps={{ htmlInput: { min: 0, style: { textAlign: "right" } } }}
                                        value={item.quantity}
                                        onChange={e => update(i, "quantity", parseFloat(e.target.value) || 0)} />
                                </TableCell>
                                <TableCell>
                                    <TextField variant="standard" type="number"
                                        slotProps={{ htmlInput: { min: 0, step: 0.01, style: { textAlign: "right" } } }}
                                        value={item.unitPrice}
                                        onChange={e => update(i, "unitPrice", parseFloat(e.target.value) || 0)} />
                                </TableCell>
                                {vatEnabled && (
                                    <TableCell>
                                        <Select variant="standard" value={item.taxRate} sx={{ width: "100%" }}
                                            onChange={e => update(i, "taxRate", Number(e.target.value))}>
                                            {TAX_RATES.map(r => <MenuItem key={r} value={r}>{r} %</MenuItem>)}
                                        </Select>
                                    </TableCell>
                                )}
                                <TableCell>
                                    <TextField variant="standard" type="number"
                                        slotProps={{ htmlInput: { min: 0, step: 0.01, style: { textAlign: "right" } } }}
                                        value={total(item)}
                                        onChange={e => updateTotal(i, parseFloat(e.target.value) || 0)} />
                                </TableCell>
                                <TableCell padding="checkbox">
                                    <IconButton size="small" onClick={() => remove(i)}>
                                        <Delete fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
            <Button startIcon={<Add />} size="small" onClick={add} sx={{ mt: 1 }}>
                Pridať položku
            </Button>
        </Box>
    );
};
