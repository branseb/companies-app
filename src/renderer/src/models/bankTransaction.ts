export interface BankAccount {
    id: number;
    name: string;
    iban?: string;
    currency: string;
    note?: string;
}

export interface Tx {
    id: number;
    date: string;
    amount: number;
    currency: string;
    description?: string;
    counterpartyName?: string;
    counterpartyIban?: string;
    variableSymbol?: string;
    constantSymbol?: string;
    specificSymbol?: string;
    note?: string;
    linkedInvoiceId?: number;
    bankAccountId?: number;
    pairedCashEntryId?: number;
}

export interface InvoiceOption {
    id: number;
    invoiceNumber: string;
    issueDate: string;
    partyName: string;
    netTotal: number;
    grossTotal: number;
    currency: string;
    type: "issued" | "received";
}

export interface MatchSuggestion {
    tx: Tx;
    invoice: InvoiceOption;
    score: number;
    reasons: string[];
}

export type ImportRow = Omit<Tx, "id">;

export type ColMapping = {
    date: number | "";
    amount: number | "";
    creditAmount: number | "";
    debitAmount: number | "";
    description: number | "";
    counterpartyName: number | "";
    counterpartyIban: number | "";
    variableSymbol: number | "";
    constantSymbol: number | "";
    specificSymbol: number | "";
};

export const FIELD_LABELS: Record<keyof ColMapping, string> = {
    date: "Dátum *",
    amount: "Suma (±)",
    creditAmount: "Príjem",
    debitAmount: "Výdaj",
    description: "Popis",
    counterpartyName: "Protistrana",
    counterpartyIban: "IBAN protistrany",
    variableSymbol: "VS",
    constantSymbol: "KS",
    specificSymbol: "ŠS",
};

export const fmt = (n: number, currency: string) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
