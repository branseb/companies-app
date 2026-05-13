import { Avatar, Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import {
    AccountBalance, BadgeOutlined, Business,
    EmailOutlined, LocationOnOutlined, MoveToInbox,
    NoteAdd, PhoneOutlined, ReceiptLong, WarningAmberOutlined,
} from "@mui/icons-material";
import type { SvgIconComponent } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../context/company";

// ─── Tiles ────────────────────────────────────────────────────────────────────

interface Tile { label: string; icon: SvgIconComponent; color: string; page: string; }

const tiles: Tile[] = [
    { label: "Vytvoriť faktúru",       icon: NoteAdd,        color: "#1976d2", page: "new-invoice"          },
    { label: "Vydané faktúry",         icon: ReceiptLong,    color: "#7b1fa2", page: "invoices/issued"      },
    { label: "Prijaté faktúry",        icon: MoveToInbox,    color: "#e65100", page: "invoices/received"    },
    { label: "Bankové pohyby",         icon: AccountBalance, color: "#00695c", page: "bank"                 },
    { label: "Údaje firmy",            icon: Business,       color: "#2e7d32", page: "edit"                 },
];

// ─── Stats ────────────────────────────────────────────────────────────────────

interface DashboardStats {
    unpaidCount: number;
    overdueCount: number;
    accountBalances: { name: string; balance: number; currency: string }[];
}

const fmtCurrency = (n: number, currency: string) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

interface StatCardProps {
    label: string;
    value: string;
    sub?: string;
    color: "default" | "warning" | "error" | "success" | "info";
    icon: React.ReactNode;
}

const STAT_COLORS = {
    default: { bg: "grey.100",    text: "text.primary",    icon: "text.secondary"  },
    warning: { bg: "warning.50",  text: "warning.dark",    icon: "warning.main"    },
    error:   { bg: "error.50",    text: "error.dark",      icon: "error.main"      },
    success: { bg: "success.50",  text: "success.dark",    icon: "success.main"    },
    info:    { bg: "info.50",     text: "info.dark",       icon: "info.main"       },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, color, icon }) => {
    const c = STAT_COLORS[color];
    return (
        <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5, bgcolor: c.bg, borderColor: "transparent", minWidth: 160 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                <Stack gap={0.5}>
                    <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase" letterSpacing={0.5}>
                        {label}
                    </Typography>
                    <Typography variant="h5" fontWeight={700} color={c.text} lineHeight={1}>
                        {value}
                    </Typography>
                    {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
                </Stack>
                <Box sx={{ color: c.icon, opacity: 0.7, mt: 0.5 }}>{icon}</Box>
            </Stack>
        </Paper>
    );
};

// ─── Company card ─────────────────────────────────────────────────────────────

interface InfoItemProps { icon: React.ReactNode; label: string; value: string; mono?: boolean; }

const InfoItem: React.FC<InfoItemProps> = ({ icon, label, value, mono }) => (
    <Stack direction="row" alignItems="center" gap={1.5}>
        <Box sx={{ color: "primary.main", display: "flex", flexShrink: 0 }}>{icon}</Box>
        <Box>
            <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>{label}</Typography>
            <Typography variant="body2" fontWeight={500} fontFamily={mono ? "monospace" : undefined}>{value}</Typography>
        </Box>
    </Stack>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

export const CompanyHome = () => {
    const navigate = useNavigate();
    const { activeCompany } = useCompany();
    const [stats, setStats] = useState<DashboardStats | null>(null);

    useEffect(() => {
        if (!activeCompany) return;
        const today = new Date(new Date().toDateString());
        Promise.all([
            window.api.invoice.byCompany(activeCompany.ico),
            window.api.bankTransaction.byCompany(activeCompany.id!),
            window.api.bankAccount.byCompany(activeCompany.id!),
        ]).then(([invoices, txs, accounts]) => {
            const unpaid = invoices.filter((i: any) => !i.paid);
            const overdue = unpaid.filter((i: any) => i.dueDate && new Date(i.dueDate) < today);
            const balanceMap = new Map<number, number>();
            txs.forEach((t: any) => {
                if (!t.bankAccountId) return;
                balanceMap.set(t.bankAccountId, (balanceMap.get(t.bankAccountId) ?? 0) + (t.amount as number));
            });
            const accountBalances = (accounts as any[]).map(a => ({
                name: a.name as string,
                balance: balanceMap.get(a.id) ?? 0,
                currency: a.currency as string,
            }));
            setStats({ unpaidCount: unpaid.length, overdueCount: overdue.length, accountBalances });
        });
    }, [activeCompany]);

    if (!activeCompany) return null;

    const initials = activeCompany.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join("");

    const address = [activeCompany.address, activeCompany.zip, activeCompany.city].filter(Boolean).join(", ");
    const idFields = [
        activeCompany.ico   && { label: "IČO",    value: activeCompany.ico,   mono: true  },
        activeCompany.dic   && { label: "DIČ",    value: activeCompany.dic,   mono: true  },
        activeCompany.icDph && { label: "IČ DPH", value: activeCompany.icDph, mono: true  },
    ].filter(Boolean) as { label: string; value: string; mono: boolean }[];

    return (
        <Stack gap={4}>
            {/* Company card */}
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
                {/* Header band */}
                <Box sx={{ bgcolor: "primary.main", px: 3, py: 2.5, color: "white" }}>
                    <Stack direction="row" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: "primary.dark", width: 52, height: 52, fontSize: 20, fontWeight: 700 }}>
                            {initials}
                        </Avatar>
                        <Box>
                            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                                {activeCompany.name}
                            </Typography>
                            {activeCompany.ico && (
                                <Typography variant="caption" sx={{ opacity: 0.8 }}>IČO {activeCompany.ico}</Typography>
                            )}
                        </Box>
                    </Stack>
                </Box>

                {/* Info grid */}
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
                <Stack gap={1.5}>
                    <Typography variant="overline" color="text.secondary" fontWeight={600}>Prehľad</Typography>
                    <Stack direction="row" gap={2} flexWrap="wrap">
                        <StatCard
                            label="Neuhradené faktúry"
                            value={String(stats.unpaidCount)}
                            color={stats.unpaidCount > 0 ? "warning" : "default"}
                            icon={<ReceiptLong />}
                        />
                        {stats.overdueCount > 0 && (
                            <StatCard
                                label="Po splatnosti"
                                value={String(stats.overdueCount)}
                                sub="faktúr čaká na úhradu"
                                color="error"
                                icon={<WarningAmberOutlined />}
                            />
                        )}
                        {stats.accountBalances.map(a => (
                            <StatCard
                                key={a.name}
                                label={a.name}
                                value={fmtCurrency(a.balance, a.currency)}
                                color={a.balance >= 0 ? "success" : "error"}
                                icon={<AccountBalance />}
                            />
                        ))}
                    </Stack>
                </Stack>
            )}

            {/* Navigation tiles */}
            <Grid container spacing={2.5}>
                {tiles.map((tile) => {
                    const Icon = tile.icon;
                    return (
                        <Grid key={tile.page} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Box
                                onClick={() => navigate(`/${activeCompany!.id}/${tile.page}`)}
                                sx={{
                                    bgcolor: tile.color,
                                    color: "white",
                                    borderRadius: 3,
                                    p: 3.5,
                                    cursor: "pointer",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 1.5,
                                    userSelect: "none",
                                    "&:hover": { filter: "brightness(1.12)" },
                                    "&:active": { filter: "brightness(0.92)" },
                                    transition: "filter 0.15s",
                                }}
                            >
                                <Icon sx={{ fontSize: 42 }} />
                                <Typography variant="h6" fontWeight={600} fontSize={15}>
                                    {tile.label}
                                </Typography>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>
        </Stack>
    );
};
