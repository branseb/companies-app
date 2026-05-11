import React, { useEffect, useState } from "react";
import { TextField, Button, Paper, Typography, Grid, Snackbar, Alert } from "@mui/material";
import { mapToEN16931 } from "../utils/mapToEN16931";
import type { SimpleInvoice } from "../models/SimpleInvoice";
import { CurrencySelect } from "./currencySelect";
import { SearchOutlined } from "@mui/icons-material";
import { useCompany } from "../context/company";
import { CompanyInfo } from "./companyInfo";

export const InvoiceForm: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {

    const { activeCompany } = useCompany();
    const [invoice, setInvoice] = useState<SimpleInvoice | null>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

    const today = new Date();
    const due = new Date();
    due.setDate(today.getDate() + 14);
    const format = (d: Date) => d.toISOString().split("T")[0];

    useEffect(() => {
        if (!activeCompany) return;

        setInvoice({
            invoiceNumber: "",

            issueDate: format(today),
            dueDate: format(due),
            currency: "EUR",
            delivery: {
                actualDeliveryDate: format(today)
            },
            supplier: {
                name: activeCompany.name,
                ico: activeCompany.ico,
                dic: activeCompany.dic,
                icDph: activeCompany.icDph,
                address: activeCompany.address,
                city: activeCompany.city,
                zip: activeCompany.zip,
                country: activeCompany.country,
                email: activeCompany.email,
                phone: activeCompany.phone,
            },

            customer: {
                name: "Odberatel a.s.",
                ico: "888 644 150",
            },

            items: [
                { description: "polozka", quantity: 1, unitPrice: 33.25, taxRate: 20 },
                { description: "dodanie", quantity: 1, unitPrice: 2.99, taxRate: 23 },
            ],
        });
    }, [activeCompany]);

    const fetchNextId = async (ico: string) => {
        try {
            const res = await window.api.invoice.nextId(ico);
            setInvoice(prev => {
                if (!prev) return prev;

                return {
                    ...prev,
                    invoiceNumber: res
                };
            });
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (!activeCompany?.ico) return;
        fetchNextId(activeCompany.ico);
    }, [activeCompany]);

    const handleChange = <K extends keyof SimpleInvoice>(field: K, value: SimpleInvoice[K]) =>
        setInvoice(prev => {
            if (!prev) return prev;
            return { ...prev, [field]: value };
        });

    const handleCustomerChange = (
        field: keyof SimpleInvoice["customer"],
        value: string
    ) => {
        setInvoice(prev => {
            if (!prev) return prev;

            return {
                ...prev,
                customer: {
                    ...prev.customer,
                    [field]: value,
                },
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoice || !activeCompany) return;
        const enInvoice = mapToEN16931(invoice)
        console.log(enInvoice)
        try {
            await window.api.invoice.create(enInvoice);
            onAdd();
            setSnackbar({ open: true, message: "Faktúra uložená", severity: "success" });
            await fetchNextId(activeCompany.ico);
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, message: "Chyba pri ukladaní faktúry", severity: "error" });
        }
    };

    if (!invoice) return <Typography>vyber firmu</Typography>

    return (
        <Paper style={{ padding: 20, marginBottom: 20 }}>
            <Typography variant="h5" gutterBottom>
                Vytvoriť faktúru
            </Typography>
            <CompanyInfo />
            <form onSubmit={handleSubmit}>

                <Grid container spacing={2}>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Číslo faktúry"
                            fullWidth
                            value={invoice.invoiceNumber}
                            onChange={(e) =>
                                handleChange("invoiceNumber", e.target.value)
                            }
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Ico"
                            fullWidth
                            value={invoice.customer.ico}
                            onChange={(e) =>
                                handleCustomerChange("ico", e.target.value)
                            }
                            slotProps={{
                                input: {
                                    endAdornment:
                                        <SearchOutlined
                                            onClick={() => {
                                                console.log('search icon click')
                                            }}
                                            sx={{ cursor: 'pointer' }} />
                                }
                            }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Zakaznik"
                            fullWidth
                            value={invoice.customer.name}
                            onChange={(e) =>
                                handleCustomerChange('name', e.target.value)
                            }
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Dátum vystavenia"
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={invoice.issueDate}
                            onChange={(e) =>
                                handleChange('issueDate', e.target.value)
                            }
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Dátum splatnosti"
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={invoice.dueDate || ""}
                            onChange={(e) =>
                                handleChange('dueDate', e.target.value)
                            }
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Dátum dodania"
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={invoice.delivery?.actualDeliveryDate || ""}
                            onChange={(e) =>
                                handleChange('delivery', { actualDeliveryDate: e.target.value })
                            }
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <CurrencySelect
                            onChange={(currency) => handleChange('currency', currency)} invoice={invoice} />
                    </Grid>

                    <Grid size={{ xs: 12 }} >
                        <Button type="submit" variant="contained">
                            Vytvoriť faktúru
                        </Button>
                    </Grid>

                </Grid>
            </form>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(s => ({ ...s, open: false }))}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Paper>
    );
};