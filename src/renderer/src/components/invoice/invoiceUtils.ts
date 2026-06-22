import type { InvoiceRow } from "./invoiceTypes";
import { fmtCurrency } from "@e-companies/shared";

export { fmtCurrency as fmtMoney }

export function tryParse(json: string) {
    try { return JSON.parse(json); } catch { return null; }
}

export function formatDate(date?: string) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("sk-SK");
}

export function isOverdue(inv: InvoiceRow): boolean {
    if (inv.paid) return false;
    if (!inv.dueDate) return false;
    return new Date(inv.dueDate) < new Date(new Date().toDateString());
}


export function computeTotal(itemsJson: string): number {
    const items = tryParse(itemsJson) ?? [];
    return items.reduce((s: number, it: any) => {
        const net = it.lineExtensionAmount ?? 0;
        const vat = it.item?.classifiedTaxCategory?.percent ?? 0;
        return s + net * (1 + vat / 100);
    }, 0);
}

export function downloadCSV(content: string, filename: string) {
    const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
