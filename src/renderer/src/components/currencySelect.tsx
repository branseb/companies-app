import { Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import React from "react";
import type { SimpleInvoice } from "../models/SimpleInvoice";

type CurrencySelectProps = {
    invoice: SimpleInvoice;
    onChange: (currency: string) => void;
}

export const CurrencySelect: React.FC<CurrencySelectProps> = ({ invoice, onChange }) => {
    return (
        <FormControl fullWidth>
            <InputLabel id="currency-label">Mena</InputLabel>
            <Select
                labelId="currency-label"
                value={invoice.currency}
                label="Mena"
                onChange={(e) => onChange(e.target.value)}
            >
                <MenuItem value="EUR">EUR</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="GBP">GBP</MenuItem>
                <MenuItem value="CZK">CZK</MenuItem>
            </Select>
        </FormControl>
    );
};