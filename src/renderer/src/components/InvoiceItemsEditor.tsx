import React from "react";
import {
    Table, TableHead, TableBody, TableRow, TableCell,
    TextField, IconButton, Button, Box,
    Select, MenuItem, Autocomplete,
} from "@mui/material";
import { Add, Delete } from "@mui/icons-material";
import type { InvoiceItem } from "../models/SimpleInvoice";

const TAX_RATES = [0, 5, 10, 19, 20, 23];
const UNITS = ["ks", "hod", "deň", "kg", "g", "l", "m", "m²", "m³"];

interface Props {
    items: InvoiceItem[];
    onChange: (items: InvoiceItem[]) => void;
    vatEnabled?: boolean;
}

export const InvoiceItemsEditor: React.FC<Props> = ({ items, onChange, vatEnabled = true }) => {
    const update = (index: number, field: keyof InvoiceItem, value: string | number) => {
        const updated = items.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        );
        onChange(updated);
    };

    const add = () => onChange([...items, { description: "", quantity: 1, unitPrice: 0, taxRate: 20 }]);

    const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

    const total = (item: InvoiceItem) =>
        item.quantity * item.unitPrice * (1 + item.taxRate / 100);

    const updateTotal = (index: number, totalValue: number) => {
        const item = items[index];
        const divisor = item.quantity * (1 + item.taxRate / 100);
        const unitPrice = divisor !== 0 ? totalValue / divisor : 0;
        update(index, "unitPrice", Math.round(unitPrice * 10000) / 10000);
    };

    return (
        <Box>
            <Table size="small">
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
                                <TextField
                                    variant="standard"
                                    fullWidth
                                    value={item.description}
                                    onChange={e => update(i, "description", e.target.value)}
                                    placeholder="Popis položky"
                                />
                            </TableCell>
                            <TableCell>
                                <Autocomplete
                                    freeSolo
                                    options={UNITS}
                                    value={item.unit ?? ""}
                                    onInputChange={(_e, val) => update(i, "unit", val)}
                                    renderInput={params => (
                                        <TextField {...params} variant="standard" placeholder="ks" />
                                    )}
                                    disableClearable
                                    sx={{ width: 70 }}
                                />
                            </TableCell>
                            <TableCell>
                                <TextField
                                    variant="standard"
                                    type="number"
                                    inputProps={{ min: 0, style: { textAlign: "right" } }}
                                    value={item.quantity}
                                    onChange={e => update(i, "quantity", parseFloat(e.target.value) || 0)}
                                />
                            </TableCell>
                            <TableCell>
                                <TextField
                                    variant="standard"
                                    type="number"
                                    inputProps={{ min: 0, step: 0.01, style: { textAlign: "right" } }}
                                    value={item.unitPrice}
                                    onChange={e => update(i, "unitPrice", parseFloat(e.target.value) || 0)}
                                />
                            </TableCell>
                            {vatEnabled && (
                                <TableCell>
                                    <Select
                                        variant="standard"
                                        value={item.taxRate}
                                        onChange={e => update(i, "taxRate", Number(e.target.value))}
                                        sx={{ width: "100%" }}
                                    >
                                        {TAX_RATES.map(r => (
                                            <MenuItem key={r} value={r}>{r} %</MenuItem>
                                        ))}
                                    </Select>
                                </TableCell>
                            )}
                            <TableCell>
                                <TextField
                                    variant="standard"
                                    type="number"
                                    inputProps={{ min: 0, step: 0.01, style: { textAlign: "right" } }}
                                    value={Math.round(total(item) * 100) / 100}
                                    onChange={e => updateTotal(i, parseFloat(e.target.value) || 0)}
                                />
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
            <Button startIcon={<Add />} size="small" onClick={add} sx={{ mt: 1 }}>
                Pridať položku
            </Button>
        </Box>
    );
};
