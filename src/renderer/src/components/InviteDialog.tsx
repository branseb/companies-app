import React, { useEffect, useState } from "react";
import {
    Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, IconButton, InputAdornment, Stack, Table,
    TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
    Alert,
} from "@mui/material";
import { ContentCopy, Delete, Edit, Link, Refresh, Save } from "@mui/icons-material";

type InviteStep = "idle" | "loading" | "link" | "error";

type Invite = {
    id: string;
    companyName: string;
    expiresAt: string | null;
    createdAt: string | null;
    used: boolean;
    usedByUid: string | null;
}

type InviteDialogProps = {
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
    const [confirmRevoke, setConfirmRevoke] = useState<Invite | null>(null);
    const [revoking, setRevoking] = useState(false);
    const [editingUrl, setEditingUrl] = useState(false);
    const [urlDraft, setUrlDraft] = useState("");

    async function savePortalUrl() {
        const url = urlDraft.trim().replace(/\/$/, "");
        await window.api.invite.setPortalUrl(url);
        setPortalUrl(url);
        setEditingUrl(false);
    }

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

    async function handleDelete(inv: Invite) {
        if (inv.used && inv.usedByUid) {
            setConfirmRevoke(inv);
        } else {
            await window.api.invite.delete(inv.id);
            setInvites(prev => prev.filter(i => i.id !== inv.id));
        }
    }

    async function handleRevokeConfirm(mode: 'suspend' | 'delete' | 'inviteOnly') {
        if (!confirmRevoke) return;
        setRevoking(true);
        try {
            if (confirmRevoke.usedByUid) {
                if (mode === 'suspend') await window.api.invite.revokeAccess(confirmRevoke.usedByUid);
                if (mode === 'delete')  await window.api.invite.deleteUser(confirmRevoke.usedByUid);
            }
            await window.api.invite.delete(confirmRevoke.id);
            setInvites(prev => prev.filter(i => i.id !== confirmRevoke.id));
            setConfirmRevoke(null);
        } finally {
            setRevoking(false);
        }
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
                    <Stack gap={1.5}>
                        <Typography color="text.secondary">
                            Vygeneruje sa jednorazový odkaz platný 7 dní. Firma sa ním zaregistruje na portáli.
                        </Typography>
                        {editingUrl ? (
                            <TextField
                                size="small"
                                label="URL portálu"
                                value={urlDraft}
                                onChange={e => setUrlDraft(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && savePortalUrl()}
                                autoFocus
                                fullWidth
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton size="small" onClick={savePortalUrl} color="primary">
                                                    <Save fontSize="small" />
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                            />
                        ) : (
                            <Stack direction="row" alignItems="center" gap={0.5}>
                                <Typography variant="caption" color="text.secondary">
                                    Portál: <strong>{portalUrl || "—"}</strong>
                                </Typography>
                                <IconButton size="small" onClick={() => { setUrlDraft(portalUrl); setEditingUrl(true); }}>
                                    <Edit sx={{ fontSize: 14 }} />
                                </IconButton>
                            </Stack>
                        )}
                    </Stack>
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
                            <Typography variant="subtitle2" fontWeight={600}>Portálový prístup</Typography>
                            <IconButton size="small" onClick={loadList} disabled={listLoading}>
                                <Refresh fontSize="small" />
                            </IconButton>
                        </Stack>
                        {listLoading ? (
                            <CircularProgress size={20} />
                        ) : (() => {
                            const activeUsers = invites.filter(i => i.used);
                            const otherInvites = invites.filter(i => !i.used);

                            const renderActions = (inv: Invite) => {
                                const isActive = !inv.used && !!inv.expiresAt && new Date(inv.expiresAt) > new Date();
                                return (
                                    <Stack direction="row" justifyContent="flex-end">
                                        {isActive && portalUrl && (
                                            <Tooltip title={copiedId === inv.id ? "Skopírované!" : "Skopírovať odkaz"}>
                                                <IconButton size="small" onClick={() => copyInviteLink(inv.id)}>
                                                    <ContentCopy fontSize="small" color={copiedId === inv.id ? "success" : "inherit"} />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {isActive && confirmRevoke?.id !== inv.id && (
                                            <Tooltip title="Zrušiť pozvánku">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(inv)}>
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {inv.used && confirmRevoke?.id !== inv.id && (
                                            <Tooltip title="Zrušiť prístup">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(inv)}>
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {!inv.used && !isActive && confirmRevoke?.id !== inv.id && (
                                            <Tooltip title="Zmazať">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(inv)}>
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Stack>
                                );
                            };

                            return (
                                <Stack gap={2}>
                                    {activeUsers.length > 0 && (
                                        <Stack gap={0.5}>
                                            <Typography variant="caption" color="success.main" fontWeight={600} textTransform="uppercase">
                                                Aktívni užívatelia
                                            </Typography>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Užívateľ</TableCell>
                                                        <TableCell>Pozvanka vytvorená</TableCell>
                                                        <TableCell align="right" />
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {activeUsers.map(inv => (
                                                        <TableRow key={inv.id}>
                                                            <TableCell sx={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                {inv.usedByUid ? (userNames[inv.usedByUid] ?? inv.usedByUid) : "—"}
                                                            </TableCell>
                                                            <TableCell>{fmtDate(inv.createdAt)}</TableCell>
                                                            <TableCell align="right">{renderActions(inv)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </Stack>
                                    )}

                                    {otherInvites.length > 0 && (
                                        <Stack gap={0.5}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                                                Odoslané pozvánky
                                            </Typography>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Vytvorená</TableCell>
                                                        <TableCell>Platná do</TableCell>
                                                        <TableCell>Stav</TableCell>
                                                        <TableCell align="right" />
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {otherInvites.map(inv => {
                                                        const status = inviteStatus(inv);
                                                        return (
                                                            <TableRow key={inv.id}>
                                                                <TableCell>{fmtDate(inv.createdAt)}</TableCell>
                                                                <TableCell>{fmtDate(inv.expiresAt)}</TableCell>
                                                                <TableCell>
                                                                    <Chip size="small" label={status.label} color={status.color} />
                                                                </TableCell>
                                                                <TableCell align="right">{renderActions(inv)}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </Stack>
                                    )}
                                </Stack>
                            );
                        })()}

                    {confirmRevoke && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            <Typography variant="body2" mb={1}>
                                Chcete aj zrušiť prístup užívateľovi <strong>{userNames[confirmRevoke.usedByUid!] ?? confirmRevoke.usedByUid}</strong> na portál?
                            </Typography>
                            <Stack direction="row" gap={1} flexWrap="wrap">
                                <Button size="small" variant="contained" color="error" disabled={revoking}
                                    onClick={() => handleRevokeConfirm('suspend')}>
                                    Pozastaviť prístup
                                </Button>
                                <Button size="small" variant="contained" color="error" disabled={revoking}
                                    onClick={() => handleRevokeConfirm('delete')}>
                                    Zmazať účet
                                </Button>
                                <Button size="small" variant="outlined" disabled={revoking}
                                    onClick={() => handleRevokeConfirm('inviteOnly')}>
                                    Len zmazať pozvánku
                                </Button>
                                <Button size="small" disabled={revoking}
                                    onClick={() => setConfirmRevoke(null)}>
                                    Zrušiť
                                </Button>
                            </Stack>
                        </Alert>
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
