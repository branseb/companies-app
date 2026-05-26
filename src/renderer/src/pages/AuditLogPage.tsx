import { useEffect, useState } from "react";
import {
    Chip, CircularProgress, Paper, Stack, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import { useCompany } from "../context/company";

type LogEntry = {
    id: number;
    action: string;
    entityType: string;
    entityId?: number;
    details?: string;
    createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; color: "success" | "error" | "info" | "warning" | "default" }> = {
    create:      { label: "Vytvorené",  color: "success" },
    update:      { label: "Upravené",   color: "info" },
    delete:      { label: "Vymazané",   color: "error" },
    paid:        { label: "Uhradené",   color: "success" },
    unpaid:      { label: "Neuhradené", color: "warning" },
    "bulk-import": { label: "Import",  color: "info" },
};

const ENTITY_LABELS: Record<string, string> = {
    invoice:         "Faktúra",
    bankTransaction: "Bankový pohyb",
    cashEntry:       "Pokladňa",
};

const fmtDetails = (details?: string): string => {
    if (!details) return "";
    try {
        const obj = JSON.parse(details);
        return Object.entries(obj)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ");
    } catch {
        return details;
    }
};

const fmtTime = (iso: string) => {
    try {
        return new Date(iso).toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" });
    } catch {
        return iso;
    }
};

export const AuditLogPage = () => {
    const { activeCompany, activeConfigId } = useCompany();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!activeCompany) return;
        setLoading(true);
        window.api.auditLog.byCompany(activeConfigId!, activeCompany.ico ?? "")
            .then(setLogs)
            .finally(() => setLoading(false));
    }, [activeCompany?.id]);

    return (
        <Stack gap={3}>
            <Typography variant="h5" fontWeight={700}>Záznam zmien</Typography>

            {loading ? (
                <Stack alignItems="center" py={6}><CircularProgress /></Stack>
            ) : logs.length === 0 ? (
                <Typography color="text.secondary">Zatiaľ žiadne záznamy.</Typography>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Čas</TableCell>
                                <TableCell>Akcia</TableCell>
                                <TableCell>Typ</TableCell>
                                <TableCell>ID</TableCell>
                                <TableCell>Detaily</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {logs.map(log => {
                                const action = ACTION_LABELS[log.action] ?? { label: log.action, color: "default" as const };
                                return (
                                    <TableRow key={log.id} hover>
                                        <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary", fontSize: 12 }}>
                                            {fmtTime(log.createdAt)}
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={action.label} color={action.color} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {ENTITY_LABELS[log.entityType] ?? log.entityType}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            {log.entityId ? (
                                                <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                                                    #{log.entityId}
                                                </Typography>
                                            ) : "—"}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" color="text.secondary">
                                                {fmtDetails(log.details)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Stack>
    );
};
