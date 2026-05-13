import React from "react";
import { Box, Grid, Typography } from "@mui/material";
import type { InvoiceRow } from "./invoiceTypes";
import { tryParse, formatDate } from "./invoiceUtils";

const DetailField: React.FC<{ label: string; value?: string }> = ({ label, value }) =>
    value ? (
        <>
            <Grid size={{ xs: 4 }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
            </Grid>
            <Grid size={{ xs: 8 }}>
                <Typography variant="caption">{value}</Typography>
            </Grid>
        </>
    ) : null;

export const InvoiceDetail: React.FC<{ inv: InvoiceRow; type: "issued" | "received" }> = ({ inv, type }) => {
    const supplier = tryParse(inv.supplier);
    const customer = tryParse(inv.customer);
    const items: any[] = tryParse(inv.items) ?? [];

    const party = type === "issued" ? customer : supplier;
    const partyLabel = type === "issued" ? "Zákazník" : "Dodávateľ";

    return (
        <Box sx={{ px: 3, py: 2, bgcolor: "grey.50" }}>
            <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="overline" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
                        {partyLabel}
                    </Typography>
                    <Grid container rowSpacing={0.5}>
                        <DetailField label="Názov" value={party?.partyName} />
                        <DetailField label="IČO" value={party?.partyLegalEntity?.companyID} />
                        <DetailField label="IČ DPH" value={party?.partyTaxScheme?.companyID} />
                        <DetailField label="Mesto" value={party?.postalAddress?.cityName} />
                    </Grid>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="overline" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
                        Faktúra
                    </Typography>
                    <Grid container rowSpacing={0.5}>
                        <DetailField label="Vystavená" value={formatDate(inv.issueDate)} />
                        <DetailField label="Splatnosť" value={formatDate(inv.dueDate)} />
                        <DetailField label="Mena" value={inv.currency} />
                    </Grid>
                </Grid>

                {items.length > 0 && (
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Typography variant="overline" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
                            Položky
                        </Typography>
                        {items.map((item, i) => (
                            <Box key={i} sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                <Typography variant="caption">{item.item?.name ?? item.description}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 2, whiteSpace: "nowrap" }}>
                                    {item.invoicedQuantity} × {item.price?.priceAmount?.toFixed(2)}
                                </Typography>
                            </Box>
                        ))}
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};
