import { Chip, IconButton, Stack, Tooltip } from "@mui/material";
import { LinkOff, Receipt } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../../context/company";
import type { InvoiceOption } from "../../models/bankTransaction";
import { fmtCurrency } from "../../utils/formatters";

type Props = {
    invoice: InvoiceOption;
    onUnlink: () => void;
    showAmount?: boolean;
}

export const LinkedInvoiceChip: React.FC<Props> = ({ invoice, onUnlink, showAmount }) => {
    const navigate = useNavigate();
    const { activeConfigId } = useCompany();
    return (
        <Stack direction="row" alignItems="center" gap={0.5}>
            <Chip
                icon={<Receipt sx={{ fontSize: 14 }} />}
                label={invoice.invoiceNumber}
                size="small"
                color={invoice.type === "issued" ? "primary" : "warning"}
                variant="outlined"
                onClick={() => navigate(`/${activeConfigId}/invoices/${invoice.type}`, { state: { highlightId: invoice.id } })}
                title={showAmount
                    ? `${invoice.partyName} | ${fmtCurrency(invoice.grossTotal, invoice.currency)}`
                    : invoice.partyName}
                sx={{ cursor: "pointer" }}
            />
            <Tooltip title="Odpojiť faktúru">
                <IconButton size="small" onClick={onUnlink}>
                    <LinkOff sx={{ fontSize: 14 }} />
                </IconButton>
            </Tooltip>
        </Stack>
    );
};

type UnlinkedProps = {
    onLink: () => void;
}

export const UnlinkedInvoiceButton: React.FC<UnlinkedProps> = ({ onLink }) => (
    <Tooltip title="Priradiť faktúru">
        <IconButton size="small" onClick={onLink}>
            <Receipt fontSize="small" sx={{ opacity: 0.3 }} />
        </IconButton>
    </Tooltip>
);
