import React from "react";
import { Box, Grid, Typography } from "@mui/material";

interface Props {
    title: string;
    children: React.ReactNode;
}

export const FormSection: React.FC<Props> = ({ title, children }) => (
    <Grid size={{ xs: 12 }}>
        <Box sx={{ border: "1px solid", borderColor: "grey.200", borderRadius: 2, p: 2 }}>
            <Typography
                variant="overline"
                fontWeight={700}
                color="text.secondary"
                display="block"
                sx={{ mb: 2, lineHeight: 1 }}
            >
                {title}
            </Typography>
            <Grid container spacing={2}>
                {children}
            </Grid>
        </Box>
    </Grid>
);
