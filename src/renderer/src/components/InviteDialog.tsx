import React, { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { ContentCopy, Link } from "@mui/icons-material";

type InviteStep = "idle" | "loading" | "link" | "error";

interface InviteDialogProps {
    open: boolean;
    onClose: () => void;
    companyId: string;
    companyName: string;
}

export const InviteDialog: React.FC<InviteDialogProps> = ({ open, onClose, companyId, companyName }) => {
    const [step, setStep] = useState<InviteStep>("idle");
    const [link, setLink] = useState("");
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    async function generate() {
        setStep("loading");
        try {
            const configured = await window.api.invite.isConfigured();
            if (!configured) {
                const res = await window.api.invite.setup();
                if (!res.success) { setError(res.error ?? "Nastavenie zlyhalo"); setStep("error"); return; }
            }
            const { link: url } = await window.api.invite.create(companyId, companyName);
            setLink(url);
            setStep("link");
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Neznáma chyba");
            setStep("error");
        }
    }

    function handleClose() {
        setStep("idle"); setLink(""); setError(""); setCopied(false); onClose();
    }

    function copyLink() {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Pozvať firmu na portál</DialogTitle>
            <DialogContent>
                {step === "idle" && (
                    <Typography color="text.secondary">
                        Vygeneruje sa jednorazový odkaz platný 7 dní. Firma sa ním zaregistruje na portáli.
                    </Typography>
                )}
                {step === "loading" && <Typography>Generujem odkaz…</Typography>}
                {step === "link" && (
                    <Stack gap={2} mt={1}>
                        <Typography variant="body2" color="text.secondary">
                            Pošlite tento odkaz firme <strong>{companyName}</strong>:
                        </Typography>
                        <TextField
                            value={link}
                            fullWidth
                            size="small"
                            InputProps={{
                                readOnly: true,
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={copyLink} edge="end">
                                            <ContentCopy fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        {copied && <Typography variant="caption" color="success.main">Skopírované!</Typography>}
                    </Stack>
                )}
                {step === "error" && <Typography color="error">{error}</Typography>}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Zavrieť</Button>
                {step === "idle" && (
                    <Button variant="contained" startIcon={<Link />} onClick={generate}>
                        Generovať odkaz
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};
