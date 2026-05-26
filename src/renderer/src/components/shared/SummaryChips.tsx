import React from "react";
import { Chip, Stack } from "@mui/material";
import { LocalAtm } from "@mui/icons-material";
import { fmtCurrency } from "../../utils/formatters";

type Props = {
    income: number;
    expense: number;
    currency: string;
    showBalanceIcon?: boolean;
}

export const SummaryChips: React.FC<Props> = ({ income, expense, currency, showBalanceIcon }) => {
    const balance = income + expense;
    return (
        <Stack direction="row" gap={1} flexWrap="wrap">
            <Chip label={`Príjmy: ${fmtCurrency(income, currency)}`} color="success" variant="outlined" />
            <Chip label={`Výdaje: ${fmtCurrency(expense, currency)}`} color="error" variant="outlined" />
            <Chip
                label={`Zostatok: ${fmtCurrency(balance, currency)}`}
                color={balance >= 0 ? "primary" : "error"}
                icon={showBalanceIcon ? <LocalAtm /> : undefined}
            />
        </Stack>
    );
};
