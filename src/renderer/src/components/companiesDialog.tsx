import { Close, Delete, Edit } from "@mui/icons-material";
import {
    Box, Button, Dialog, DialogContent, DialogTitle, IconButton,
    Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography, type DialogProps
} from "@mui/material";
import { Fragment, useState } from "react";
import { useCompany } from "../context/company";
import { AddCompanyConfigDialog } from "./AddCompanyConfigDialog";
import { CompanyConfig } from "../models/companyConfig";

export const CompaniesDialog = (props: DialogProps) => {
    const { open, onClose } = props;
    const { companyConfigs, activeConfigId, addCompanyConfig, updateCompanyConfig, deleteCompanyConfig } = useCompany();
    const [editTarget, setEditTarget] = useState<CompanyConfig | undefined>();
    const [dialogOpen, setDialogOpen] = useState(false);

    const openAdd = () => { setEditTarget(undefined); setDialogOpen(true); };
    const openEdit = (c: CompanyConfig) => { setEditTarget(c); setDialogOpen(true); };
    const closeDialog = () => setDialogOpen(false);

    const handleConfirm = async (data: { name: string; connectionString: string }) => {
        if (editTarget) {
            await updateCompanyConfig({ ...editTarget, ...data });
        } else {
            await addCompanyConfig(data);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Naozaj odstrániť toto pripojenie?")) return;
        await deleteCompanyConfig(id);
    };

    return (
        <Fragment>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
                <DialogTitle>
                    <Stack justifyContent="space-between" direction="row" alignItems="center">
                        <Typography variant="h6">Správa pripojení k databázam</Typography>
                        <IconButton onClick={() => onClose?.({}, "backdropClick")}>
                            <Close />
                        </IconButton>
                    </Stack>
                </DialogTitle>

                <DialogContent>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Názov firmy</TableCell>
                                <TableCell>Connection string</TableCell>
                                <TableCell align="right">Akcie</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {companyConfigs.map((c) => (
                                <TableRow
                                    key={c.id}
                                    sx={{
                                        backgroundColor: activeConfigId === c.id ? "rgba(25,118,210,0.12)" : "transparent",
                                        borderLeft: activeConfigId === c.id ? "4px solid #1976d2" : "4px solid transparent",
                                    }}
                                >
                                    <TableCell>{c.name}</TableCell>
                                    <TableCell
                                        title={c.connectionString}
                                        sx={{ fontFamily: "monospace", fontSize: 12, maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                    >
                                        {c.connectionString}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            <IconButton size="small" onClick={() => openEdit(c)}>
                                                <Edit fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" color="error" onClick={() => handleDelete(c.id)}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {companyConfigs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} align="center">
                                        <Typography color="text.secondary" py={2}>Žiadne pripojenia</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                        <Button variant="text" onClick={openAdd}>
                            + Pridať firmu
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>

            <AddCompanyConfigDialog
                open={dialogOpen}
                config={editTarget}
                onClose={closeDialog}
                onConfirm={handleConfirm}
            />
        </Fragment>
    );
};
