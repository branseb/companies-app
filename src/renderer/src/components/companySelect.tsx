import { Box, IconButton, MenuItem, Select, Stack, Typography } from "@mui/material";
import { useCompany } from "../context/company";
import { Settings } from "@mui/icons-material";
import { useState } from "react";
import { CompaniesDialog } from "./companiesDialog";

export const CompanySelect = () => {
    const { companies, activeCompany, setActiveCompanyID } = useCompany();
    const [openCompaniesDialog, setOpenCompaniesDialog] = useState(false);
    return (
        <Stack padding={2} gap={2} >
            <Stack direction={'row'} justifyContent={'space-between'} alignItems={'center'}>
                <Typography variant="h6">
                    Firma
                </Typography>

                <IconButton onClick={() => setOpenCompaniesDialog(true)}>
                    <Settings />
                </IconButton>
                <CompaniesDialog
                    open={openCompaniesDialog}
                    onClose={() => setOpenCompaniesDialog(false)} />
            </Stack>
            <Stack gap={1}>
                {companies.map((c) => {
                    const isActive = activeCompany?.id === c.id;

                    return (
                        <Box
                            key={c.id}
                            onClick={() => setActiveCompanyID(c.id)}
                            sx={{
                                p: 1.5,
                                borderRadius: 2,
                                cursor: "pointer",
                                border: "1px solid",
                                borderColor: isActive ? "primary.main" : "grey.300",
                                backgroundColor: isActive ? "primary.light" : "transparent",
                                "&:hover": {
                                    backgroundColor: "grey.100",
                                }
                            }}
                        >
                            <Typography fontWeight={600}>
                                {c.name}
                            </Typography>

                            <Typography variant="body2" color="text.secondary">
                                IČO: {c.ico}
                            </Typography>
                        </Box>
                    );
                })}
            </Stack>
        </Stack>
    );
}