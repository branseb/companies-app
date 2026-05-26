export type CashRegister = {
    id: number;
    name: string;
    currency: string;
    note?: string;
}

export type CashEntry = {
    id: number;
    date: string;
    amount: number;
    currency: string;
    description?: string;
    note?: string;
    cashRegisterId?: number;
    linkedInvoiceId?: number;
    pairedBankTransactionId?: number;
}

export { fmtCurrency as fmt } from "../utils/formatters";
