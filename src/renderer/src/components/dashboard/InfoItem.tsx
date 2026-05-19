import React from "react";
import { Box, Stack, Typography } from "@mui/material";

interface InfoItemProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    mono?: boolean;
}

export const InfoItem: React.FC<InfoItemProps> = ({ icon, label, value, mono }) => (
    <Stack direction="row" alignItems="center" gap={1.5}>
        <Box sx={{ color: "primary.main", display: "flex", flexShrink: 0 }}>{icon}</Box>
        <Box>
            <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
            <Typography variant="body2" fontWeight={500} fontFamily={mono ? "monospace" : undefined}>{value}</Typography>
        </Box>
    </Stack>
);
