import { Avatar, Badge, Box, Button, Grid, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import {
    AccountBalance, BadgeOutlined, Backup, Business, Chat,
    EmailOutlined, Folder, History, Link, LocalAtm, LocationOnOutlined,
    MoveToInbox, NoteAdd, PhoneOutlined, ReceiptLong, WarningAmberOutlined,
} from "@mui/icons-material";
import { useFirebaseAuth } from "../context/firebaseAuth";
import { useChat } from "../hooks/useChat";
import type { SvgIconComponent } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../context/company";
import { computeTotal } from "../components/invoice/invoiceUtils";
import { fmtCurrency } from "../utils/formatters";
import { StatCard } from "../components/dashboard/StatCard";
import { InfoItem } from "../components/dashboard/InfoItem";
import { InviteDialog } from "../components/InviteDialog";

// ─── Tiles ────────────────────────────────────────────────────────────────────

interface Tile { label: string; icon: SvgIconComponent; color: string; page: string; }

const tiles: Tile[] = [
    { label: "Vytvoriť faktúru",  icon: NoteAdd,       color: "#1976d2", page: "new-invoice"       },
    { label: "Vydané faktúry",    icon: ReceiptLong,   color: "#7b1fa2", page: "invoices/issued"   },
    { label: "Prijaté faktúry",   icon: MoveToInbox,   color: "#e65100", page: "invoices/received" },
    { label: "Bankové pohyby",    icon: AccountBalance, color: "#00695c", page: "bank"             },
    { label: "Pokladňa",          icon: LocalAtm,      color: "#6a1b9a", page: "cash"              },
    { label: "Dokumenty",         icon: Folder,        color: "#0277bd", page: "documents"         },
    { label: "Údaje firmy",       icon: Business,      color: "#2e7d32", page: "edit"              },
];

// ─── Stats helpers ────────────────────────────────────────────────────────────

interface InvoiceStat {
    count: number;
    totals: { currency: string; amount: number }[];
}

interface DashboardStats {
    unpaidIssued: InvoiceStat;
    unpaidReceived: InvoiceStat;
    overdueIssued: InvoiceStat;
    overdueReceived: InvoiceStat;
    accountBalances: { name: string; balance: number; currency: string }[];
    cashBalances: { name: string; balance: number; currency: string }[];
}

function calcStat(invoices: any[]): InvoiceStat {
    const map = new Map<string, number>();
    for (const inv of invoices) {
        const cur = inv.currency ?? "EUR";
        map.set(cur, (map.get(cur) ?? 0) + computeTotal(inv.items));
    }
    return {
        count: invoices.length,
        totals: Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount })),
    };
}

const fmtTotals = (totals: { currency: string; amount: number }[]): string =>
    totals.length === 0 ? "—" : totals.map(t => fmtCurrency(t.amount, t.currency)).join(" | ");

// ─── Main ─────────────────────────────────────────────────────────────────────

export const CompanyHome = () => {
    const navigate = useNavigate();
    const { activeCompany, activeConfigId } = useCompany();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [exporting, setExporting] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const { fbUser } = useFirebaseAuth();
    const { messages } = useChat(activeConfigId ?? "", "accountant", !!fbUser);
    const unread = fbUser ? messages.filter(m => m.from === "company" && !m.readByAccountant).length : 0;

    const handleBackup = async () => {
        if (!activeCompany?.id) return;
        setExporting(true);
        try {
            await window.api.backup.export(activeConfigId!, activeCompany.id);
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        if (!activeCompany) return;
        const today = new Date(new Date().toDateString());
        Promise.all([
            window.api.invoice.byCompany(activeConfigId!, activeCompany.ico),
            window.api.invoice.byCustomer(activeConfigId!, activeCompany.ico),
            window.api.bankTransaction.byCompany(activeConfigId!, activeCompany.id!),
            window.api.bankAccount.byCompany(activeConfigId!, activeCompany.id!),
            window.api.cashEntry.byCompany(activeConfigId!, activeCompany.id!),
            window.api.cashRegister.byCompany(activeConfigId!, activeCompany.id!),
        ]).then(([issued, received, txs, accounts, cashEntries, cashRegs]) => {
            const unpaidIssued    = (issued as any[]).filter(i => !i.paid);
            const unpaidReceived  = (received as any[]).filter(i => !i.paid);
            const overdueIssued   = unpaidIssued.filter(i => i.dueDate && new Date(i.dueDate) < today);
            const overdueReceived = unpaidReceived.filter(i => i.dueDate && new Date(i.dueDate) < today);

            const balanceMap = new Map<number, number>();
            (txs as any[]).forEach(t => {
                if (t.bankAccountId) balanceMap.set(t.bankAccountId, (balanceMap.get(t.bankAccountId) ?? 0) + (t.amount as number));
            });
            const accountBalances = (accounts as any[]).map(a => ({
                name: a.name as string,
                balance: balanceMap.get(a.id) ?? 0,
                currency: a.currency as string,
            }));

            const cashBalanceMap = new Map<number, number>();
            (cashEntries as any[]).forEach(e => {
                if (e.cashRegisterId) cashBalanceMap.set(e.cashRegisterId, (cashBalanceMap.get(e.cashRegisterId) ?? 0) + (e.amount as number));
            });
            const cashBalances = (cashRegs as any[]).map(r => ({
                name: r.name as string,
                balance: cashBalanceMap.get(r.id) ?? 0,
                currency: r.currency as string,
            }));

            setStats({
                unpaidIssued:    calcStat(unpaidIssued),
                unpaidReceived:  calcStat(unpaidReceived),
                overdueIssued:   calcStat(overdueIssued),
                overdueReceived: calcStat(overdueReceived),
                accountBalances,
                cashBalances,
            });
        });
    }, [activeCompany]);

    if (!activeCompany) return null;

    const initials = activeCompany.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
    const address  = [activeCompany.address, activeCompany.zip, activeCompany.city].filter(Boolean).join(", ");
    const idFields = [
        activeCompany.ico   && { label: "IČO",    value: activeCompany.ico,   mono: true },
        activeCompany.dic   && { label: "DIČ",    value: activeCompany.dic,   mono: true },
        activeCompany.icDph && { label: "IČ DPH", value: activeCompany.icDph, mono: true },
    ].filter(Boolean) as { label: string; value: string; mono: boolean }[];

    return (
        <>
        <Stack gap={4}>
            {/* Utility actions */}
            <Stack direction="row" gap={1} justifyContent="flex-end">
                <Button size="small" variant="outlined" startIcon={<History />} onClick={() => navigate(`/${activeConfigId}/audit`)}>
                    Záznam zmien
                </Button>
                <Button size="small" variant="outlined" startIcon={<Backup />} onClick={handleBackup} disabled={exporting}>
                    {exporting ? "Exportujem..." : "Záloha dát"}
                </Button>
                <Button size="small" variant="contained" startIcon={<Link />} onClick={() => setInviteOpen(true)}>
                    Pozvať na portál
                </Button>
            </Stack>

            {/* Company card */}
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
                <Box sx={{ bgcolor: "primary.main", px: 3, py: 2.5, color: "white" }}>
                    <Stack direction="row" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: "primary.dark", width: 52, height: 52, fontSize: 20, fontWeight: 700 }}>
                            {initials}
                        </Avatar>
                        <Box flex={1}>
                            <Typography variant="h6" fontWeight={700}>{activeCompany.name}</Typography>
                            {activeCompany.ico && (
                                <Typography variant="caption" sx={{ opacity: 0.8 }}>IČO {activeCompany.ico}</Typography>
                            )}
                        </Box>
                        <Tooltip title="Chat s firmou">
                            <IconButton onClick={() => navigate(`/${activeConfigId}/chat`)} sx={{ color: "white" }}>
                                <Badge badgeContent={unread} color="error"><Chat /></Badge>
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Box>
                <Box sx={{ p: 3 }}>
                    <Grid container spacing={2.5}>
                        {idFields.map(f => (
                            <Grid key={f.label} size={{ xs: 12, sm: 6, md: 4 }}>
                                <InfoItem icon={<BadgeOutlined fontSize="small" />} label={f.label} value={f.value} mono={f.mono} />
                            </Grid>
                        ))}
                        {address && (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <InfoItem icon={<LocationOnOutlined fontSize="small" />} label="Adresa" value={address} />
                            </Grid>
                        )}
                        {activeCompany.email && (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <InfoItem icon={<EmailOutlined fontSize="small" />} label="Email" value={activeCompany.email} />
                            </Grid>
                        )}
                        {activeCompany.phone && (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <InfoItem icon={<PhoneOutlined fontSize="small" />} label="Telefón" value={activeCompany.phone} />
                            </Grid>
                        )}
                    </Grid>
                </Box>
            </Paper>

            {/* Stats */}
            {stats && (
                <Stack direction="row" gap={2} flexWrap="wrap" alignItems="stretch">
                    <Paper variant="outlined" sx={{ borderRadius: 2, p: 1, flex: "0 0 auto" }}>
                        <Stack gap={0.75}>
                            <Typography variant="overline" color="text.secondary" fontWeight={600} display="block">Neuhradené faktúry</Typography>
                            <Stack direction="row" gap={1} flexWrap="wrap">
                                <StatCard label="Vydané"  value={String(stats.unpaidIssued.count)}   sub={fmtTotals(stats.unpaidIssued.totals)}   color={stats.unpaidIssued.count > 0 ? "warning" : "default"}   icon={<ReceiptLong />} />
                                <StatCard label="Prijaté" value={String(stats.unpaidReceived.count)} sub={fmtTotals(stats.unpaidReceived.totals)} color={stats.unpaidReceived.count > 0 ? "warning" : "default"} icon={<MoveToInbox />} />
                            </Stack>
                        </Stack>
                    </Paper>

                    {(stats.overdueIssued.count > 0 || stats.overdueReceived.count > 0) && (
                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 1, flex: "0 0 auto", borderColor: "error.light" }}>
                            <Stack gap={0.75}>
                                <Typography variant="overline" color="error.main" fontWeight={600} display="block">Po splatnosti</Typography>
                                <Stack direction="row" gap={1} flexWrap="wrap">
                                    {stats.overdueIssued.count > 0 && (
                                        <StatCard label="Vydané"  value={String(stats.overdueIssued.count)}   sub={fmtTotals(stats.overdueIssued.totals)}   color="error" icon={<WarningAmberOutlined />} />
                                    )}
                                    {stats.overdueReceived.count > 0 && (
                                        <StatCard label="Prijaté" value={String(stats.overdueReceived.count)} sub={fmtTotals(stats.overdueReceived.totals)} color="error" icon={<WarningAmberOutlined />} />
                                    )}
                                </Stack>
                            </Stack>
                        </Paper>
                    )}

                    {stats.accountBalances.length > 0 && (
                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 1, flex: "0 0 auto" }}>
                            <Stack gap={0.75}>
                                <Typography variant="overline" color="text.secondary" fontWeight={600} display="block">Bankové účty</Typography>
                                <Stack direction="row" gap={1} flexWrap="wrap">
                                    {stats.accountBalances.map(a => (
                                        <StatCard key={a.name} label={a.name} value={fmtCurrency(a.balance, a.currency)} color={a.balance >= 0 ? "success" : "error"} icon={<AccountBalance />} />
                                    ))}
                                </Stack>
                            </Stack>
                        </Paper>
                    )}

                    {stats.cashBalances.length > 0 && (
                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 1, flex: "0 0 auto" }}>
                            <Stack gap={0.75}>
                                <Typography variant="overline" color="text.secondary" fontWeight={600} display="block">Pokladne</Typography>
                                <Stack direction="row" gap={1} flexWrap="wrap">
                                    {stats.cashBalances.map(c => (
                                        <StatCard key={c.name} label={c.name} value={fmtCurrency(c.balance, c.currency)} color={c.balance >= 0 ? "success" : "error"} icon={<LocalAtm />} />
                                    ))}
                                </Stack>
                            </Stack>
                        </Paper>
                    )}
                </Stack>
            )}

            {/* Navigation tiles */}
            <Grid container spacing={2.5}>
                {tiles.map((tile) => {
                    const Icon = tile.icon;
                    return (
                        <Grid key={tile.page} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Box
                                onClick={() => navigate(`/${activeConfigId}/${tile.page}`)}
                                sx={{
                                    bgcolor: tile.color, color: "white", borderRadius: 3, p: 3.5,
                                    cursor: "pointer", display: "flex", flexDirection: "column",
                                    alignItems: "center", gap: 1.5, userSelect: "none",
                                    "&:hover": { filter: "brightness(1.12)" },
                                    "&:active": { filter: "brightness(0.92)" },
                                    transition: "filter 0.15s",
                                }}
                            >
                                <Icon sx={{ fontSize: 42 }} />
                                <Typography variant="h6" fontWeight={600} fontSize={15}>{tile.label}</Typography>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>
        </Stack>

        {activeConfigId && (
            <InviteDialog
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                companyId={activeConfigId}
                companyName={activeCompany.name}
            />
        )}
        </>
    );
};
