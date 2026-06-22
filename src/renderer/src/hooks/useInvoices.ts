import { useCallback, useState } from "react";
import { useCompany } from "../context/company";
import type { InvoiceOption } from "../models/bankTransaction";
import { toInvoiceOption } from "../utils/bankTransactionParsers";

export const useInvoices = () => {
    const { activeCompany, activeConfigId } = useCompany();
    const [invoices, setInvoices] = useState<InvoiceOption[]>([]);

    const loadInvoices = useCallback(async () => {
        if (!activeCompany) return;
        const [issued, received] = await Promise.all([
            window.api.invoice.byCompany(activeConfigId!, activeCompany.id!),
            window.api.invoice.byCustomer(activeConfigId!, activeCompany.id!),
        ]);
        setInvoices([
            ...issued.map((i: any) => toInvoiceOption(i, "issued")),
            ...received.map((i: any) => toInvoiceOption(i, "received")),
        ]);
    }, [activeCompany, activeConfigId]);

    return { invoices, setInvoices, loadInvoices };
};
