import React from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";

export interface StatCardProps {
    label: string;
    value: string;
    sub?: string;
    color: "default" | "warning" | "error" | "success" | "info";
    icon: React.ReactNode;
}

const STAT_COLORS = {
    default: { bg: "", text: "text.primary", icon: "text.secondary" },
    warning: { bg: "warning.50", text: "warning.dark", icon: "warning.main" },
    error:   { bg: "error.50",   text: "error.dark",   icon: "error.main"   },
    success: { bg: "success.50", text: "success.dark", icon: "success.main" },
    info:    { bg: "info.50",    text: "info.dark",    icon: "info.main"    },
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, sub, color, icon }) => {
    const c = STAT_COLORS[color];
    return (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, bgcolor: c.bg, borderColor: "transparent", minWidth: 110 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Stack gap={0.25}>
                    <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase" letterSpacing={0.5} fontSize={10}>
                        {label}
                    </Typography>
                    <Typography variant="h6" fontWeight={700} color={c.text}>
                        {value}
                    </Typography>
                    {sub && <Typography variant="caption" color="text.secondary" fontSize={11}>{sub}</Typography>}
                </Stack>
                <Box sx={{ color: c.icon, opacity: 0.6 }}>{icon}</Box>
            </Stack>
        </Paper>
    );
};
