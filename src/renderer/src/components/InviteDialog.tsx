import React, { useEffect, useState } from "react";
import {
    Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, IconButton, InputAdornment, Stack, Table,
    TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { ContentCopy, Link, Refresh } from "@mui/icons-material";

type InviteStep = "idle" | "loading" | "link" | "error";

interface Invite {
    id: string;
    companyName: string;
    expiresAt: string | null;
    createdAt: string | null;
    used: boolean;
    usedByUid: string | null;
}

interface InviteDialogProps {
    open: boolean;
    onClose: () => void;
    companyId: string;
    companyName: string;
}

function inviteStatus(invite: Invite): { label: string; color: "success" | "default" | "error" } {
    if (invite.used) return { label: "Použitá", color: "success" };
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return { label: "Expirovaná", color: "error" };
    return { label: "Aktívna", color: "default" };
}

function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const InviteDialog: React.FC<InviteDialogProps> = ({ open, onClose, companyId, companyName }) => {
    const [step, setStep] = useState<InviteStep>("idle");
    const [link, setLink] = useState("");
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [invites, setInvites] = useState<Invite[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [portalUrl, setPortalUrl] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [userNames, setUserNames] = useState<Record<string, string>>({});

    async function loadList() {
        setListLoading(true);
        try {
            const [data, url] = await Promise.all([
                window.api.invite.list(),
                window.api.invite.getPortalUrl(),
            ]);
            setPortalUrl(url ?? "");
            const filtered = (data as Invite[]).filter(i => i.companyName === companyName);
            setInvites(filtered);

            const uids = filtered.filter(i => i.used && i.usedByUid).map(i => i.usedByUid as string);
            if (uids.length > 0) {
                const results = await Promise.all(uids.map(uid => window.api.invite.getUser(uid)));
                const names: Record<string, string> = {};
                uids.forEach((uid, i) => {
                    const r = results[i] as { email: string | null; displayName: string | null };
                    names[uid] = r.displayName || r.email || uid;
                });
                setUserNames(names);
            }
        } finally {
            setListLoading(false);
        }
    }

    useEffect(() => {
        if (open) loadList();
    }, [open]);

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
            loadList();
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

    function copyInviteLink(inviteId: string) {
        navigator.clipboard.writeText(`${portalUrl}/invite/${inviteId}`);
        setCopiedId(inviteId);
        setTimeout(() => setCopiedId(null), 2000);
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

                {(invites.length > 0 || listLoading) && (
                    <>
                        <Divider sx={{ my: 2 }} />
                        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                            <Typography variant="subtitle2" fontWeight={600}>Odoslané pozvánky</Typography>
                            <IconButton size="small" onClick={loadList} disabled={listLoading}>
                                <Refresh fontSize="small" />
                            </IconButton>
                        </Stack>
                        {listLoading ? (
                            <CircularProgress size={20} />
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Vytvorená</TableCell>
                                        <TableCell>Platná do</TableCell>
                                        <TableCell>Stav</TableCell>
                                        <TableCell>Prijal (UID)</TableCell>
                                        <TableCell align="right" />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {invites.map(inv => {
                                        const status = inviteStatus(inv);
                                        const isActive = !inv.used && !!inv.expiresAt && new Date(inv.expiresAt) > new Date();
                                        return (
                                            <TableRow key={inv.id}>
                                                <TableCell>{fmtDate(inv.createdAt)}</TableCell>
                                                <TableCell>{fmtDate(inv.expiresAt)}</TableCell>
                                                <TableCell>
                                                    <Chip size="small" label={status.label} color={status.color} />
                                                </TableCell>
                                                <TableCell sx={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {inv.usedByUid ? (userNames[inv.usedByUid] ?? inv.usedByUid) : "—"}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {isActive && portalUrl && (
                                                        <Tooltip title={copiedId === inv.id ? "Skopírované!" : "Skopírovať odkaz"}>
                                                            <IconButton size="small" onClick={() => copyInviteLink(inv.id)}>
                                                                <ContentCopy fontSize="small" color={copiedId === inv.id ? "success" : "inherit"} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </>
                )}
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
