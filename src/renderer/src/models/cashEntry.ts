export interface CashRegister {
    id: number;
    name: string;
    currency: string;
    note?: string;
}

export interface CashEntry {
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

export const fmt = (n: number, currency: string) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
