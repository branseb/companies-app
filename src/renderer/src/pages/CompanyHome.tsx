import { Box, Divider, Grid, Stack, Typography } from "@mui/material";
import { ReceiptLong, NoteAdd, Business } from "@mui/icons-material";
import type { SvgIconComponent } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../context/company";

interface Tile {
    label: string;
    icon: SvgIconComponent;
    color: string;
    page: string;
}

const tiles: Tile[] = [
    { label: "Vytvoriť faktúru", icon: NoteAdd,     color: "#1976d2", page: "new-invoice" },
    { label: "Zoznam faktúr",    icon: ReceiptLong, color: "#7b1fa2", page: "invoices"    },
    { label: "Údaje firmy",      icon: Business,    color: "#2e7d32", page: "edit"        },
];

export const CompanyHome = () => {
    const navigate = useNavigate();
    const { activeCompany } = useCompany();

    if (!activeCompany) return null;

    return (
        <Stack gap={4}>
            <Box>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                    {activeCompany.name}
                </Typography>
                <Divider sx={{ mb: 1.5 }} />
                <Grid container spacing={1}>
                    {activeCompany.ico && <InfoRow label="IČO" value={activeCompany.ico} />}
                    {activeCompany.dic && <InfoRow label="DIČ" value={activeCompany.dic} />}
                    {activeCompany.icDph && <InfoRow label="IČ DPH" value={activeCompany.icDph} />}
                    {(activeCompany.address || activeCompany.city) && (
                        <InfoRow
                            label="Adresa"
                            value={[activeCompany.address, activeCompany.zip, activeCompany.city].filter(Boolean).join(", ")}
                        />
                    )}
                    {activeCompany.email && <InfoRow label="Email" value={activeCompany.email} />}
                    {activeCompany.phone && <InfoRow label="Tel." value={activeCompany.phone} />}
                </Grid>
            </Box>

            <Grid container spacing={3}>
                {tiles.map((tile) => {
                    const Icon = tile.icon;
                    return (
                        <Grid key={tile.page} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Box
                                onClick={() => navigate(`/${activeCompany!.id}/${tile.page}`)}
                                sx={{
                                    bgcolor: tile.color,
                                    color: "white",
                                    borderRadius: 3,
                                    p: 4,
                                    cursor: "pointer",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 2,
                                    userSelect: "none",
                                    "&:hover": { filter: "brightness(1.12)" },
                                    "&:active": { filter: "brightness(0.92)" },
                                    transition: "filter 0.15s",
                                }}
                            >
                                <Icon sx={{ fontSize: 48 }} />
                                <Typography variant="h6" fontWeight={600}>
                                    {tile.label}
                                </Typography>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>
        </Stack>
    );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <>
        <Grid size={{ xs: 4, sm: 3, md: 2 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Grid>
        <Grid size={{ xs: 8, sm: 9, md: 10 }}>
            <Typography variant="body2">{value}</Typography>
        </Grid>
    </>
);
