import { Box, Button, Grid, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useCompany, type Company } from "../context/company";

interface Props {
    onSaved: () => void;
}

export const EditCompanyPage = ({ onSaved }: Props) => {
    const { activeCompany, updateCompany } = useCompany();
    const [form, setForm] = useState<Company>(activeCompany!);

    const set = (field: keyof Company, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        await updateCompany(form);
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
                    <TextField fullWidth label="IČO" disabled value={form.ico} />
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
            </Grid>
        </Box>
    );
};
