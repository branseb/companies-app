import { Box, Button, Stack, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../context/company";
import { CompaniesDialog } from "../components/companiesDialog";

export const SelectCompanyPage = () => {
    const { companies } = useCompany();
    const navigate = useNavigate();
    const [openDialog, setOpenDialog] = useState(false);

    return (
        <Stack height="100%" alignItems="center" justifyContent="center" gap={4}>
            <Typography variant="h4" fontWeight={700}>
                Vyberte firmu
            </Typography>

            <Stack gap={2} width="100%" maxWidth={400}>
                {companies.map((c) => (
                    <Box
                        key={c.id}
                        onClick={() => navigate(`/${c.id}`)}
                        sx={{
                            p: 2.5,
                            borderRadius: 2,
                            cursor: "pointer",
                            border: "1px solid",
                            borderColor: "grey.300",
                            "&:hover": { borderColor: "primary.main", backgroundColor: "primary.50" },
                            transition: "all 0.15s",
                        }}
                    >
                        <Typography fontWeight={600} fontSize={16}>{c.name}</Typography>
                        <Typography variant="body2" color="text.secondary">IČO: {c.ico}</Typography>
                    </Box>
                ))}

                {companies.length === 0 && (
                    <Typography color="text.secondary" textAlign="center">
                        Žiadne firmy. Pridajte prvú firmu.
                    </Typography>
                )}
            </Stack>

            <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setOpenDialog(true)}
            >
                Pridať firmu
            </Button>

            <CompaniesDialog open={openDialog} onClose={() => setOpenDialog(false)} />
        </Stack>
    );
};
