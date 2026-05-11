import { Box, Button, Dialog, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { Company } from "../models/company";

type AddCompanyDialogProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: (company: Company) => void,
    company?: Company;
};

const defaultCompany: Company = {
    id: undefined,
    name: "",
    ico: "",
    dic: "",
    icDph: "",
    address: "",
    city: "",
    zip: "",
    country: "",
    email: "",
    phone: "",
}

export const AddCompanyDialog = (props: AddCompanyDialogProps) => {
    const { company, onClose, onConfirm, open } = props;
    const [form, setForm] = useState<Company>(defaultCompany);

    useEffect(() => {
        setForm(company ?? defaultCompany);
    }, [setForm, company])

    const handleChange = (field: keyof Company, value: string) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <Box sx={{ p: 3, minWidth: 400 }}>
                <TextField
                    fullWidth
                    label="Názov firmy"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    sx={{ mb: 1 }}
                />

                <TextField
                    fullWidth
                    label="IČO"
                    disabled={!!company?.id}
                    value={form.ico}
                    onChange={(e) => handleChange("ico", e.target.value)}
                    sx={{ mb: 1 }}
                />

                <TextField
                    fullWidth
                    label="DIČ"
                    value={form.dic}
                    onChange={(e) => handleChange("dic", e.target.value)}
                    sx={{ mb: 1 }}
                />

                <TextField
                    fullWidth
                    label="Adresa"
                    value={form.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    sx={{ mb: 1 }}
                />

                <TextField
                    fullWidth
                    label="Mesto"
                    value={form.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    sx={{ mb: 1 }}
                />

                <TextField
                    fullWidth
                    label="Email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    sx={{ mb: 2 }}
                />

                <Button
                    variant="contained"
                    fullWidth
                    onClick={() => onConfirm(form)}
                >
                    Uložiť firmu
                </Button>
            </Box>
        </Dialog>
    );
}