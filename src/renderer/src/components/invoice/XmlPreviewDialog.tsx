import React from "react";
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, Grid, Paper, Stack, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Typography,
} from "@mui/material";
import type { EN16931Invoice } from "../../models/EN16931Invoice";
import { formatDate, fmtMoney } from "./invoiceUtils";

type Props = {
    invoice: EN16931Invoice | null;
    format: string;
    open: boolean;
    onClose: () => void;
    onConfirm: (inv: EN16931Invoice) => void;
}

export const XmlPreviewDialog: React.FC<Props> = ({ invoice, format, open, onClose, onConfirm }) => {
    if (!invoice) return null;

    const supplier = invoice.accountingSupplierParty;
    const customer = invoice.accountingCustomerParty;
    const total = invoice.legalMonetaryTotal;
    const currency = invoice.documentCurrencyCode;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Import faktúry — {format}</DialogTitle>
            <DialogContent dividers>
                <Stack gap={2}>
                    <Alert severity="info">
                        Faktúra č. <strong>{invoice.id}</strong> bude uložená do databázy.
                    </Alert>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="overline" color="text.secondary" display="block">Dodávateľ</Typography>
                            <Typography fontWeight={600}>{supplier.partyName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                IČO: {supplier.partyLegalEntity?.companyID}
                                {supplier.partyTaxScheme?.companyID && ` | IČ DPH: ${supplier.partyTaxScheme.companyID}`}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {[supplier.postalAddress.streetName, supplier.postalAddress.cityName].filter(Boolean).join(", ")}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="overline" color="text.secondary" display="block">Odberateľ</Typography>
                            <Typography fontWeight={600}>{customer.partyName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                IČO: {customer.partyLegalEntity?.companyID}
                                {customer.partyTaxScheme?.companyID && ` | IČ DPH: ${customer.partyTaxScheme.companyID}`}
                            </Typography>
                        </Grid>
                    </Grid>

                    <Divider />

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="caption" color="text.secondary" display="block">Číslo</Typography>
                            <Typography>{invoice.id}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="caption" color="text.secondary" display="block">Vystavená</Typography>
                            <Typography>{formatDate(invoice.issueDate)}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="caption" color="text.secondary" display="block">Splatnosť</Typography>
                            <Typography>{formatDate(invoice.dueDate)}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="caption" color="text.secondary" display="block">Mena</Typography>
                            <Typography>{currency}</Typography>
                        </Grid>
                    </Grid>

                    <Divider />

                    <Typography variant="overline" color="text.secondary">Položky</Typography>
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: "grey.50" }}>
                                    <TableCell>Názov</TableCell>
                                    <TableCell align="right">Množstvo</TableCell>
                                    <TableCell align="right">Cena / ks</TableCell>
                                    <TableCell align="right">Spolu bez DPH</TableCell>
                                    <TableCell align="right">DPH %</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {invoice.invoiceLine.map((line, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{line.item.name}</TableCell>
                                        <TableCell align="right">{line.invoicedQuantity}</TableCell>
                                        <TableCell align="right">{fmtMoney(line.price.priceAmount, currency)}</TableCell>
                                        <TableCell align="right">{fmtMoney(line.lineExtensionAmount, currency)}</TableCell>
                                        <TableCell align="right">{line.item.classifiedTaxCategory.percent} %</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Stack direction="row" gap={2} justifyContent="flex-end" flexWrap="wrap">
                        <Chip label={`Bez DPH: ${fmtMoney(total.taxExclusiveAmount, currency)}`} variant="outlined" />
                        <Chip
                            label={`Na úhradu: ${fmtMoney(total.payableAmount, currency)}`}
                            color="primary"
                            sx={{ fontWeight: 700 }}
                        />
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zrušiť</Button>
                <Button variant="contained" onClick={() => onConfirm(invoice)}>
                    Uložiť faktúru
                </Button>
            </DialogActions>
        </Dialog>
    );
};
