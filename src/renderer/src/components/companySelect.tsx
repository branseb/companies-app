import { Box, IconButton, Stack, Typography } from "@mui/material";
import { useCompany } from "../context/company";
import { Settings } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CompaniesDialog } from "./companiesDialog";

export const CompanySelect = () => {
    const { companyConfigs, activeConfigId, selectConfig } = useCompany();
    const [openCompaniesDialog, setOpenCompaniesDialog] = useState(false);
    const navigate = useNavigate();

    const handleSelect = async (id: string) => {
        const config = companyConfigs.find(c => c.id === id);
        if (!config) return;
        await selectConfig(config);
        navigate(`/${id}`);
    };

    return (
        <Stack padding={2} gap={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Firma</Typography>
                <IconButton onClick={() => setOpenCompaniesDialog(true)}>
                    <Settings />
                </IconButton>
                <CompaniesDialog open={openCompaniesDialog} onClose={() => setOpenCompaniesDialog(false)} />
            </Stack>
            <Stack gap={1}>
                {companyConfigs.map((c) => (
                    <Box
                        key={c.id}
                        onClick={() => handleSelect(c.id)}
                        sx={{
                            p: 1.5,
                            borderRadius: 2,
                            cursor: "pointer",
                            border: "1px solid",
                            borderColor: activeConfigId === c.id ? "primary.main" : "grey.300",
                            backgroundColor: activeConfigId === c.id ? "primary.light" : "transparent",
                            "&:hover": { backgroundColor: "grey.100" }
                        }}
                    >
                        <Typography fontWeight={600}>{c.name}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                            {(() => { try { return new URL(c.connectionString).hostname; } catch { return c.connectionString; } })()}
                        </Typography>
                    </Box>
                ))}
            </Stack>
        </Stack>
    );
};
