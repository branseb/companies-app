import { Close, Delete, Edit } from "@mui/icons-material";
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography, type DialogProps } from "@mui/material";
import { Fragment, useState } from "react";
import { useCompany } from "../context/company";
import { AddCompanyDialog } from "./addCompanyDialog";
import { Company } from "../models/company";

export const CompaniesDialog = (props: DialogProps) => {
    const { open, onClose } = props;
    const { companies, activeCompany, setActiveCompanyID, addCompany } = useCompany();
    const [companyDialog, setCompanyDialog] = useState<{ open: boolean, company?: Company }>({ open: false, company: undefined });

    return (
        <Fragment>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
                <DialogTitle>
                    <Stack justifyContent={'space-between'} direction={"row"} alignItems={'center'}>
                        <Typography variant="h6">
                            Správa firiem
                        </Typography>
                        <IconButton onClick={() => onClose?.({}, 'backdropClick')}>
                            <Close />
                        </IconButton>
                    </Stack>
                </DialogTitle>

                <DialogContent>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Názov</TableCell>
                                <TableCell>IČO</TableCell>
                                <TableCell>DIČ</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell align="right">Akcie</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {companies.map((c) => (
                                <TableRow key={c.id}
                                    onClick={() => setActiveCompanyID(c.id)}
                                    sx={{
                                        cursor: "pointer",

                                        backgroundColor:
                                            activeCompany?.id === c.id
                                                ? "rgba(25, 118, 210, 0.25)"
                                                : "transparent",

                                        "&:hover": {
                                            backgroundColor: activeCompany?.id === c.id
                                                ? "rgba(25, 118, 210, 0.35)"
                                                : "rgba(0,0,0,0.04)"
                                        },

                                        borderLeft: activeCompany?.id === c.id
                                            ? "4px solid #1976d2"
                                            : "4px solid transparent",
                                    }}>
                                    <TableCell>{c.name}</TableCell>

                                    <TableCell>{c.ico}</TableCell>

                                    <TableCell>{c.dic}</TableCell>

                                    <TableCell>{c.email}</TableCell>

                                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">

                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setCompanyDialog({ open: true, company: c })
                                                }}
                                            >
                                                <Edit fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => {
                                                    console.log("delete", c.id);
                                                }}
                                            >
                                                <Delete fontSize="small" />
                                            </IconButton>

                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <Box sx={{ mt: 2, gap: 2, display: "flex", justifyContent: "flex-end" }}>
                        <Button variant="text" onClick={() => setCompanyDialog({ open: true, company: undefined })}>
                            + Pridať firmu
                        </Button>
                        <Button
                            variant="contained"
                            onClick={async () => {
                                //await window.api.company.save(companies);
                                // setCompanies(editCompanies);
                                onClose?.({}, 'backdropClick');
                            }}
                        >
                            Uložiť zmeny
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
            <AddCompanyDialog
                open={companyDialog.open}
                company={companyDialog.company}
                onClose={() => setCompanyDialog({ open: false, company: undefined })}
                onConfirm={company => company.id ? console.log('edit company', company) : addCompany(company)}
            />
        </Fragment>
    )
}