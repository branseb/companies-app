import {
    Button, CircularProgress, Dialog, DialogContent, DialogTitle,
    Stack, TextField, Typography
} from "@mui/material";
import { CheckCircle, Error } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { CompanyConfig } from "../models/companyConfig";

type FormData = { name: string; connectionString: string };

type Props = {
    open: boolean;
    onClose: () => void;
    /** Called with raw form data — parent is responsible for saving */
    onConfirm: (data: FormData) => Promise<void>;
    config?: CompanyConfig;
};

const empty = (): FormData => ({ name: "", connectionString: "" });

export const AddCompanyConfigDialog = ({ open, onClose, onConfirm, config }: Props) => {
    const [form, setForm] = useState<FormData>(empty());
    const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "error">("idle");
    const [testError, setTestError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(config ? { name: config.name, connectionString: config.connectionString } : empty());
        setTestState("idle");
        setTestError("");
    }, [config, open]);

    const resetTest = () => setTestState("idle");

    const handleTest = async () => {
        setTestState("testing");
        setTestError("");
        try {
            const result = await window.api.db.test(form.connectionString);
            if (result.success) {
                setTestState("ok");
            } else {
                setTestState("error");
                setTestError(result.error ?? "Neznáma chyba");
            }
        } catch (e: any) {
            setTestState("error");
            setTestError(e.message);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onConfirm(form);
            onClose();
        } catch (e: any) {
            setTestState("error");
            setTestError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const isValid = !!form.name.trim() && !!form.connectionString.trim();

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{config ? "Upraviť pripojenie" : "Pridať firmu"}</DialogTitle>
            <DialogContent>
                <Stack gap={2} mt={1}>
                    <TextField
                        label="Zobrazovaný názov firmy"
                        value={form.name}
                        onChange={e => { setForm(p => ({ ...p, name: e.target.value })); resetTest(); }}
                        required
                        fullWidth
                        autoFocus
                    />

                    <TextField
                        label="Connection string"
                        value={form.connectionString}
                        onChange={e => { setForm(p => ({ ...p, connectionString: e.target.value })); resetTest(); }}
                        required
                        fullWidth
                        placeholder="mssql://user:password@localhost:1433/databaza"
                        helperText="Azure SQL: sqlserver://user:heslo@server.database.windows.net:1433/db  |  Lokálny SQL Server: mssql://user:heslo@localhost:1433/db"
                    />

                    <Stack direction="row" alignItems="center" gap={2}>
                        <Button
                            variant="outlined"
                            onClick={handleTest}
                            disabled={!isValid || testState === "testing"}
                            startIcon={testState === "testing" ? <CircularProgress size={16} /> : undefined}
                        >
                            Testovať spojenie
                        </Button>
                        {testState === "ok" && (
                            <Stack direction="row" alignItems="center" gap={0.5} color="success.main">
                                <CheckCircle fontSize="small" />
                                <Typography variant="body2">Pripojenie OK</Typography>
                            </Stack>
                        )}
                        {testState === "error" && (
                            <Typography variant="body2" color="error" noWrap title={testError}>
                                Chyba: {testError}
                            </Typography>
                        )}
                    </Stack>

                    <Stack direction="row" justifyContent="flex-end" gap={1} mt={1}>
                        <Button onClick={onClose}>Zrušiť</Button>
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={!isValid || saving}
                            startIcon={saving ? <CircularProgress size={16} /> : undefined}
                        >
                            Uložiť
                        </Button>
                    </Stack>
                </Stack>
            </DialogContent>
        </Dialog>
    );
};
