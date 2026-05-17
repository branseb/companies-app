import React, { useEffect, useState } from "react";
import { TextField, Button, Paper, Typography, Grid, Snackbar, Alert, FormControlLabel, Switch, CircularProgress } from "@mui/material";
import { mapToEN16931 } from "../utils/mapToEN16931";
import type { SimpleInvoice } from "../models/SimpleInvoice";
import { CurrencySelect } from "./currencySelect";
import { useCompany } from "../context/company";

import { PartyAutocomplete } from "./PartyAutocomplete";
import { FormSection } from "./FormSection";
import { InvoiceItemsEditor } from "./InvoiceItemsEditor";
import type { InvoiceRow } from "./invoice/invoiceTypes";

// ── Convert stored InvoiceRow back to SimpleInvoice for editing ───────────────

function rowToSimple(inv: InvoiceRow): SimpleInvoice {
    const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
    const sup = tryParse(inv.supplier);
    const cus = tryParse(inv.customer);
    const rawItems: any[] = tryParse(inv.items) ?? [];

    return {
        invoiceNumber: inv.invoiceNumber,
        issueDate:     inv.issueDate,
        dueDate:       inv.dueDate ?? "",
        delivery:      inv.deliveryDate ? { actualDeliveryDate: inv.deliveryDate } : undefined,
        currency:      inv.currency,
        supplier: {
            name:    sup?.partyName ?? "",
            ico:     sup?.partyLegalEntity?.companyID ?? "",
            icDph:   sup?.partyTaxScheme?.companyID ?? "",
            address: sup?.postalAddress?.streetName ?? "",
            city:    sup?.postalAddress?.cityName ?? "",
            zip:     sup?.postalAddress?.postalZone ?? "",
            country: sup?.postalAddress?.country ?? "",
        },
        customer: {
            name:  cus?.partyName ?? "",
            ico:   cus?.partyLegalEntity?.companyID ?? "",
            icDph: cus?.partyTaxScheme?.companyID ?? "",
        },
        items: rawItems.map(it => ({
            description: it.item?.name ?? "",
            quantity:    it.invoicedQuantity ?? 1,
            unitPrice:   it.price?.priceAmount ?? 0,
            taxRate:     it.item?.classifiedTaxCategory?.percent ?? 0,
        })),
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
    onAdd: () => void;
    editInvoice?: InvoiceRow;
}

export const ReceivedInvoiceForm: React.FC<Props> = ({ onAdd, editInvoice }) => {
    const { activeCompany, activeConfigId } = useCompany();
    const [invoice, setInvoice] = useState<SimpleInvoice | null>(null);
    const [vatEnabled, setVatEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

    const today = new Date();
    const due = new Date();
    due.setDate(today.getDate() + 14);
    const format = (d: Date) => d.toISOString().split("T")[0];

    useEffect(() => {
        if (!activeCompany) return;

        if (editInvoice) {
            const simple = rowToSimple(editInvoice);
            setInvoice(simple);
            setVatEnabled(simple.items.some(it => (it.taxRate ?? 0) > 0));
            return;
        }

        setInvoice({
            invoiceNumber: "",
            issueDate: format(today),
            dueDate: format(due),
            currency: "EUR",
            delivery: { actualDeliveryDate: format(today) },
            supplier: { name: "", ico: "" },
            customer: {
                name:    activeCompany.name,
                ico:     activeCompany.ico,
                dic:     activeCompany.dic,
                icDph:   activeCompany.icDph,
                address: activeCompany.address,
                city:    activeCompany.city,
                zip:     activeCompany.zip,
                country: activeCompany.country,
                email:   activeCompany.email,
                phone:   activeCompany.phone,
            },
            items: [
                { description: "Konzultácia", quantity: 1, unitPrice: 100, taxRate: 20 },
                { description: "Vývoj",        quantity: 8, unitPrice: 50,  taxRate: 20 },
            ],
        });
    }, [activeCompany, editInvoice]);

    const handleChange = <K extends keyof SimpleInvoice>(field: K, value: SimpleInvoice[K]) =>
        setInvoice(prev => prev ? { ...prev, [field]: value } : prev);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoice) return;

        if (!invoice.invoiceNumber.trim()) {
            setSnackbar({ open: true, message: "Číslo faktúry je povinné", severity: "error" });
            return;
        }
        if (!invoice.issueDate) {
            setSnackbar({ open: true, message: "Dátum vystavenia je povinný", severity: "error" });
            return;
        }
        const totalAmount = (invoice.items ?? []).reduce((s, it) => s + it.quantity * it.unitPrice, 0);
        if (totalAmount <= 0) {
            setSnackbar({ open: true, message: "Faktúra musí obsahovať aspoň jednu položku s hodnotou > 0", severity: "error" });
            return;
        }

        setLoading(true);
        const enInvoice = mapToEN16931(invoice);
        try {
            if (editInvoice) {
                await window.api.invoice.update(activeConfigId!, Number(editInvoice.id), enInvoice);
                setSnackbar({ open: true, message: "Faktúra aktualizovaná", severity: "success" });
            } else {
                await window.api.invoice.create(activeConfigId!, enInvoice);
                setSnackbar({ open: true, message: "Faktúra uložená", severity: "success" });
            }
            onAdd();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Chyba pri ukladaní faktúry";
            setSnackbar({ open: true, message: msg, severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    if (!invoice) return <Typography>Vyber firmu</Typography>;

    return (
        <Paper style={{ padding: 20, marginBottom: 20 }}>
            <Typography variant="h5" gutterBottom>
                {editInvoice ? "Upraviť prijatú faktúru" : "Pridať prijatú faktúru"}
            </Typography>
            <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>

                    <FormSection title="Dodávateľ">
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <PartyAutocomplete
                                label="IČO"
                                value={invoice.supplier}
                                onChange={supplier => handleChange("supplier", supplier)}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Názov" fullWidth value={invoice.supplier.name}
                                onChange={e => handleChange("supplier", { ...invoice.supplier, name: e.target.value })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Ulica" fullWidth value={invoice.supplier.address ?? ""}
                                onChange={e => handleChange("supplier", { ...invoice.supplier, address: e.target.value })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <TextField label="PSČ" fullWidth value={invoice.supplier.zip ?? ""}
                                onChange={e => handleChange("supplier", { ...invoice.supplier, zip: e.target.value })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <TextField label="Mesto" fullWidth value={invoice.supplier.city ?? ""}
                                onChange={e => handleChange("supplier", { ...invoice.supplier, city: e.target.value })} />
                        </Grid>
                    </FormSection>

                    <FormSection title="Faktúra">
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Číslo faktúry" fullWidth value={invoice.invoiceNumber}
                                onChange={e => handleChange("invoiceNumber", e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <CurrencySelect onChange={currency => handleChange("currency", currency)} invoice={invoice} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="Dátum vystavenia" type="date" fullWidth
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={invoice.issueDate}
                                onChange={e => handleChange("issueDate", e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="Dátum splatnosti" type="date" fullWidth
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={invoice.dueDate ?? ""}
                                onChange={e => handleChange("dueDate", e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="Dátum dodania" type="date" fullWidth
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={invoice.delivery?.actualDeliveryDate ?? ""}
                                onChange={e => handleChange("delivery", { actualDeliveryDate: e.target.value })} />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <FormControlLabel
                                control={
                                    <Switch checked={vatEnabled} onChange={e => {
                                        const enabled = e.target.checked;
                                        setVatEnabled(enabled);
                                        if (!enabled)
                                            handleChange("items", (invoice.items ?? []).map(it => ({ ...it, taxRate: 0 })));
                                    }} />
                                }
                                label="Platca DPH"
                            />
                        </Grid>
                    </FormSection>

                    <FormSection title="Položky">
                        <Grid size={{ xs: 12 }}>
                            <InvoiceItemsEditor
                                items={invoice.items ?? []}
                                onChange={items => handleChange("items", items)}
                                vatEnabled={vatEnabled}
                            />
                        </Grid>
                    </FormSection>

                    <Grid size={{ xs: 12 }}>
                        <Button type="submit" variant="contained" disabled={loading}
                            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}>
                            {editInvoice ? "Uložiť zmeny" : "Uložiť faktúru"}
                        </Button>
                    </Grid>

                </Grid>
            </form>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Paper>
    );
};
