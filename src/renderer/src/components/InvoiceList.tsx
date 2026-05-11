import React, { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
} from "@mui/material";
import { Download } from "@mui/icons-material";
import { useCompany } from "../context/company";

interface InvoiceRow {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    currency: string;
}

export const InvoiceList: React.FC<{ refresh: boolean }> = ({ refresh }) => {
    const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
    const { activeCompany } = useCompany();

    useEffect(() => {
        if (activeCompany)
            window.api.invoice.byCompany(activeCompany.ico).then(setInvoices);
    }, [refresh, activeCompany]);

    const handleDownload = async (id: string) => {
        try {
            const filePath = await window.electron.pdf.download(id);
            window.electron.pdf.open(filePath);
        } catch (err) {
            console.error("PDF download failed:", err);
        }
    };

    return (
        <Paper style={{ padding: 20 }}>
            <Typography variant="h5" gutterBottom>
                Vystavené faktúry
            </Typography>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Číslo faktúry</TableCell>
                            <TableCell>Dátum</TableCell>
                            <TableCell>Celkom</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {invoices.map(inv => (
                            <TableRow key={inv.id}>
                                <TableCell>{inv.invoiceNumber}</TableCell>
                                <TableCell>{inv.issueDate}</TableCell>
                                <TableCell>{inv.currency}</TableCell>
                                <TableCell align="right" padding="none">
                                    <Download
                                        style={{ cursor: "pointer" }}
                                        onClick={() => handleDownload(inv.id)}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};
