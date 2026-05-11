import { Paper, Typography } from "@mui/material";
import { useCompany } from "../context/company"

export const CompanyInfo = () => {
    const { activeCompany } = useCompany();
    if (activeCompany)
        return (
            <Paper
                variant="outlined"
                sx={{ p: 2, mb: 3 }}
            >
                <Typography variant="subtitle1" fontWeight={600}>
                    Dodávateľ
                </Typography>

                <Typography>
                    {activeCompany.name}
                </Typography>

                {activeCompany.ico && (
                    <Typography variant="body2">
                        IČO: {activeCompany.ico}
                    </Typography>
                )}

                {activeCompany.dic && (
                    <Typography variant="body2">
                        DIČ: {activeCompany.dic}
                    </Typography>
                )}

                {activeCompany.icDph && (
                    <Typography variant="body2">
                        IČ DPH: {activeCompany.icDph}
                    </Typography>
                )}

                {(activeCompany.address ||
                    activeCompany.city) && (
                        <Typography variant="body2">
                            {activeCompany.address},{" "}
                            {activeCompany.zip}{" "}
                            {activeCompany.city}
                        </Typography>
                    )}

                {activeCompany.email && (
                    <Typography variant="body2">
                        Email: {activeCompany.email}
                    </Typography>
                )}

                {activeCompany.phone && (
                    <Typography variant="body2">
                        Tel: {activeCompany.phone}
                    </Typography>
                )}
            </Paper>
        )
}