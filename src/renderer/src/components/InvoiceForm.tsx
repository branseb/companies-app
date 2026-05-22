import React, { useEffect, useState } from "react";
import { Button, Paper, Typography, Grid, Snackbar, Alert, CircularProgress } from "@mui/material";
import { useSnackbar } from "../hooks/useSnackbar";
import { mapToEN16931 } from "../utils/mapToEN16931";
import type { SimpleInvoice } from "../models/SimpleInvoice";
import { useCompany } from "../context/company";
import { CompanyInfo } from "./companyInfo";
import { InvoiceFormContent } from "./InvoiceFormContent";

export const InvoiceForm: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {

    const { activeCompany, activeConfigId } = useCompany();
    const [invoice, setInvoice] = useState<SimpleInvoice | null>(null);
    const [vatEnabled, setVatEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const { snackbar, showSnackbar, closeSnackbar } = useSnackbar();

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
                { description: "Konzultácia", quantity: 1, unitPrice: 100, taxRate: 20 },
                { description: "Vývoj", quantity: 8, unitPrice: 50, taxRate: 20 },
            ],
        });
    }, [activeCompany]);

    const fetchNextId = async (ico: string) => {
        try {
            const res = await window.api.invoice.nextId(activeConfigId!, ico);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoice || !activeCompany) return;

        if (!invoice.invoiceNumber.trim()) {
            showSnackbar("Číslo faktúry je povinné", "error");
            return;
        }
        if (!invoice.issueDate) {
            showSnackbar("Dátum vystavenia je povinný", "error");
            return;
        }
        const totalAmount = (invoice.items ?? []).reduce((s, it) => s + it.quantity * it.unitPrice, 0);
        if (totalAmount <= 0) {
            showSnackbar("Faktúra musí obsahovať aspoň jednu položku s hodnotou > 0", "error");
            return;
        }

        setLoading(true);
        const enInvoice = mapToEN16931(invoice);
        try {
            await window.api.invoice.create(activeConfigId!, enInvoice);
            onAdd();
            showSnackbar("Faktúra uložená");
            await fetchNextId(activeCompany.ico);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Chyba pri ukladaní faktúry";
            showSnackbar(msg, "error");
        } finally {
            setLoading(false);
        }
    };

    if (!invoice) return <Typography>vyber firmu</Typography>

    return (
        <Paper style={{ padding: 20, marginBottom: 20 }}>
            <Typography variant="h5" gutterBottom>Vytvoriť faktúru</Typography>
            <CompanyInfo />
            <form onSubmit={handleSubmit}>
                <InvoiceFormContent
                    invoice={invoice}
                    onChange={inv => setInvoice(inv)}
                    vatEnabled={vatEnabled}
                    onVatChange={setVatEnabled}
                />
                <Grid container sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12 }}>
                        <Button type="submit" variant="contained" disabled={loading}
                            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}>
                            Vytvoriť faktúru
                        </Button>
                    </Grid>
                </Grid>
            </form>
            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={closeSnackbar}>
                <Alert severity={snackbar.severity} onClose={closeSnackbar}>{snackbar.message}</Alert>
            </Snackbar>
        </Paper>
    );
};