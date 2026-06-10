import { Alert, Box, Button, Chip, Divider, Grid, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useCompany } from "../context/company";
import { Company } from "../models/company";

type Props = {
    onSaved: () => void;
}

export const EditCompanyPage = ({ onSaved }: Props) => {
    const { activeCompany, updateCompany, activeConfigId } = useCompany();
    const [form, setForm] = useState<Company>(activeCompany!);
    const [portalEnabled, setPortalEnabled] = useState(false)
    const [migrating, setMigrating] = useState(false)
    const [migrateResult, setMigrateResult] = useState<{ migrated: number; skipped: number; total: number } | null>(null)
    const [togglingPortal, setTogglingPortal] = useState(false)

    useEffect(() => {
        if (!activeConfigId) return
        ;(window.api as any).portal.isEnabled(activeConfigId).then(setPortalEnabled)
    }, [activeConfigId])

    const handleTogglePortal = async () => {
        if (!activeConfigId) return
        setTogglingPortal(true)
        const next = !portalEnabled
        await (window.api as any).portal.setEnabled(activeConfigId, next)
        setPortalEnabled(next)
        setTogglingPortal(false)
    }

    const handleMigrate = async () => {
        if (!activeConfigId || !activeCompany?.id) return
        setMigrating(true)
        setMigrateResult(null)
        try {
            const result = await (window.api as any).portal.migrate(activeConfigId, activeCompany.id)
            setMigrateResult(result)
        } finally {
            setMigrating(false)
        }
    }

    const set = (field: keyof Company, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        await updateCompany(form);
        if (portalEnabled && activeConfigId) {
            await (window.api as any).portal.syncCompany(activeConfigId)
        }
        onSaved();
    };

    return (
        <Box maxWidth={600}>
            <Typography variant="h5" fontWeight={600} mb={3}>
                Zmena údajov firmy
            </Typography>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="Názov firmy" value={form.name} onChange={e => set("name", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="IČO" value={form.ico} onChange={e => set("ico", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="DIČ" value={form.dic ?? ""} onChange={e => set("dic", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="IČ DPH" value={form.icDph ?? ""} onChange={e => set("icDph", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="Adresa" value={form.address ?? ""} onChange={e => set("address", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth label="PSČ" value={form.zip ?? ""} onChange={e => set("zip", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField fullWidth label="Mesto" value={form.city ?? ""} onChange={e => set("city", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Krajina" value={form.country ?? ""} onChange={e => set("country", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Telefón" value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Button variant="contained" onClick={handleSave}>
                        Uložiť zmeny
                    </Button>
                </Grid>

                {/* Portal integrácia */}
                <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle1" fontWeight={600} mb={1}>
                        Integrácia s portalom
                    </Typography>
                    <Stack spacing={1.5}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Chip
                                label={portalEnabled ? 'Portal ZAPNUTÝ' : 'Portal VYPNUTÝ'}
                                color={portalEnabled ? 'success' : 'default'}
                                size="small"
                            />
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={togglingPortal}
                                onClick={handleTogglePortal}
                            >
                                {portalEnabled ? 'Vypnúť (používať SQLite)' : 'Zapnúť (používať Firebase)'}
                            </Button>
                        </Stack>

                        {portalEnabled && (
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    disabled={migrating}
                                    onClick={handleMigrate}
                                >
                                    {migrating ? 'Synchronizujem…' : 'Synchronizovať existujúce CP do portalu'}
                                </Button>
                                {migrateResult && (
                                    <Alert severity="success" sx={{ py: 0 }}>
                                        Nahraných: {migrateResult.migrated}, preskočených: {migrateResult.skipped} (z {migrateResult.total})
                                    </Alert>
                                )}
                            </Stack>
                        )}

                        <Typography variant="caption" color="text.secondary">
                            {portalEnabled
                                ? 'Cestovné príkazy sa čítajú a ukladajú vo Firebase (zdieľané s portalom).'
                                : 'Cestovné príkazy sa ukladajú len lokálne v SQLite databáze.'}
                        </Typography>
                    </Stack>
                </Grid>
            </Grid>
        </Box>
    );
};
