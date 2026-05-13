import type { ImportRow, InvoiceOption, MatchSuggestion, Tx } from "../models/bankTransaction";

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function parseCSV(text: string): string[][] {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
    return lines.map(line => {
        const cols: string[] = [];
        let cur = "";
        let inQuote = false;
        for (const ch of line) {
            if (ch === '"') { inQuote = !inQuote; continue; }
            if ((ch === "," || ch === ";") && !inQuote) { cols.push(cur.trim()); cur = ""; continue; }
            cur += ch;
        }
        cols.push(cur.trim());
        return cols;
    });
}

export function parseAmount(raw: string): number | null {
    const n = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
    return isNaN(n) ? null : n;
}

export function parseDate(raw: string): string | null {
    const d = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (d) return `${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    return null;
}

// ─── XML ──────────────────────────────────────────────────────────────────────

function txt(el: Element | null, ...tags: string[]): string {
    let cur: Element | null = el;
    for (const tag of tags) {
        if (!cur) return "";
        cur = cur.querySelector(tag) ?? [...(cur.children as any)].find((c: Element) => c.localName === tag) ?? null;
    }
    return cur?.textContent?.trim() ?? "";
}

function attr(el: Element | null, tag: string, attribute: string): string {
    if (!el) return "";
    const child = el.querySelector(tag) ?? [...(el.children as any)].find((c: Element) => c.localName === tag) ?? null;
    return child?.getAttribute(attribute) ?? "";
}

function extractNrtv(raw: string): string {
    if (!raw) return "";
    const inner = new DOMParser().parseFromString(raw, "application/xml");
    if (inner.querySelector("parsererror")) return "";
    return inner.querySelector("Nrtv")?.textContent?.trim() ?? "";
}

function parseEndToEndSymbols(s: string) {
    return {
        vs: s.match(/\/VS(\d+)/)?.[1],
        ks: s.match(/\/KS(\d+)/)?.[1],
        ss: s.match(/\/SS(\d+)/)?.[1],
    };
}

function parseCamt053(doc: Document): { rows: ImportRow[]; accountIban?: string } | null {
    const entries = doc.querySelectorAll("Ntry");
    if (!entries.length) return null;
    const stmtEl = doc.querySelector("Stmt");
    const accountIban = (stmtEl ? txt(stmtEl, "Acct", "Id", "IBAN") : "") || undefined;
    const rows: ImportRow[] = [];
    entries.forEach(ntry => {
        const amtEl = ntry.querySelector("Amt") ?? [...(ntry.children as any)].find((c: Element) => c.localName === "Amt");
        const amount = parseFloat(amtEl?.textContent?.trim() ?? "");
        if (isNaN(amount)) return;
        const ccy = amtEl?.getAttribute("Ccy") ?? attr(ntry, "Amt", "Ccy") ?? "EUR";
        const sign = txt(ntry, "CdtDbtInd") === "DBIT" ? -1 : 1;
        const bookDt = txt(ntry, "BookgDt", "Dt") || txt(ntry, "ValDt", "Dt");
        const txDtls = ntry.querySelector("TxDtls");
        const partyEl = sign === 1 ? (txDtls?.querySelector("Dbtr") ?? null) : (txDtls?.querySelector("Cdtr") ?? null);
        const acctEl  = sign === 1 ? (txDtls?.querySelector("DbtrAcct") ?? null) : (txDtls?.querySelector("CdtrAcct") ?? null);
        const endToEndId = txt(txDtls, "Refs", "EndToEndId");
        const { vs, ks, ss } = parseEndToEndSymbols(endToEndId);
        const nrtv = extractNrtv(txt(ntry, "AddtlNtryInf"));
        // EndToEndId contains raw /VS.../KS.../SS... — not useful as description
        const endToEndDesc = endToEndId.startsWith("/") ? "" : endToEndId;
        rows.push({
            date: parseDate(bookDt) ?? bookDt,
            amount: sign * amount,
            currency: ccy,
            description: txt(txDtls, "RmtInf", "Ustrd") || nrtv || endToEndDesc || undefined,
            counterpartyName: txt(partyEl, "Nm") || undefined,
            counterpartyIban: txt(acctEl, "Id", "IBAN") || txt(acctEl, "IBAN") || undefined,
            variableSymbol: txt(txDtls, "RmtInf", "Strd", "CdtrRefInf", "Ref") || txt(txDtls, "RmtInf", "Strd", "AddtlRmtInf") || vs || undefined,
            constantSymbol: ks || undefined,
            specificSymbol: ss || undefined,
        });
    });
    return rows.length ? { rows, accountIban } : null;
}

function parseFio(doc: Document): { rows: ImportRow[]; accountIban?: string } | null {
    const txEls = doc.querySelectorAll("Transaction");
    if (!txEls.length) return null;
    const getCol = (tx: Element, id: string) =>
        [...tx.querySelectorAll("Column")].find(c => c.getAttribute("id") === id)?.querySelector("Value")?.textContent?.trim() ?? "";
    const fallbackCurrency = doc.querySelector("Info currency")?.textContent?.trim() ?? doc.querySelector("currency")?.textContent?.trim() ?? "EUR";
    const infoEl = doc.querySelector("Info");
    const accountIban = infoEl?.querySelector("iban")?.textContent?.trim() || infoEl?.querySelector("IBAN")?.textContent?.trim() || undefined;
    const rows: ImportRow[] = [];
    txEls.forEach(tx => {
        const rawDate = getCol(tx, "0");
        const amount = parseAmount(getCol(tx, "1"));
        if (!amount || !rawDate) return;
        rows.push({
            date: parseDate(rawDate) ?? rawDate,
            amount,
            currency: getCol(tx, "14") || fallbackCurrency,
            description: getCol(tx, "16") || undefined,
            counterpartyName: getCol(tx, "10") || undefined,
            counterpartyIban: getCol(tx, "2") || undefined,
            variableSymbol: getCol(tx, "5") || undefined,
            constantSymbol: getCol(tx, "4") || undefined,
            specificSymbol: getCol(tx, "6") || undefined,
        });
    });
    return rows.length ? { rows, accountIban } : null;
}

function parseTatraBanka(doc: Document): { rows: ImportRow[]; accountIban?: string } | null {
    const txEls = doc.querySelectorAll("Transaction, MTRANSACTION, transaction");
    if (!txEls.length) return null;
    const accountIban = doc.querySelector("IBAN, AccountIBAN, accountIBAN")?.textContent?.trim() || undefined;
    const rows: ImportRow[] = [];
    txEls.forEach(tx => {
        const get = (...tags: string[]) => tags.map(t => tx.querySelector(t)?.textContent?.trim()).find(Boolean) ?? "";
        const amount = parseAmount(get("Amount", "AMOUNT", "Suma", "SUMA"));
        if (!amount) return;
        const typeRaw = get("Type", "TYPE", "CreditDebit", "CREDITDEBIT").toUpperCase();
        const sign = typeRaw.includes("DEBIT") || typeRaw === "D" ? -1 : 1;
        rows.push({
            date: parseDate(get("BookingDate", "BOOKINGDATE", "Date", "DATE", "Datum", "DATUM")) ?? "",
            amount: sign * Math.abs(amount),
            currency: get("Currency", "CURRENCY", "Mena", "MENA") || "EUR",
            description: get("Description", "DESCRIPTION", "Popis", "POPIS", "AdditionalInfo", "ADDITIONALINFO") || undefined,
            counterpartyName: get("CounterpartyName", "COUNTERPARTYNAME", "PartnerName", "PARTNERNAME") || undefined,
            counterpartyIban: get("CounterpartyIBAN", "COUNTERPARTYIBAN", "IBAN") || undefined,
            variableSymbol: get("VariableSymbol", "VARIABLESYMBOL", "VS") || undefined,
            constantSymbol: get("ConstantSymbol", "CONSTANTSYMBOL", "KS") || undefined,
            specificSymbol: get("SpecificSymbol", "SPECIFICSYMBOL", "SS") || undefined,
        });
    });
    return rows.length ? { rows, accountIban } : null;
}

export function parseXML(text: string): { rows: ImportRow[]; format: string; accountIban?: string } | { error: string } {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) return { error: "Neplatný XML súbor" };
    const camt = parseCamt053(doc); if (camt) return { rows: camt.rows, format: "CAMT.053 (ISO 20022)", accountIban: camt.accountIban };
    const fio  = parseFio(doc);    if (fio)  return { rows: fio.rows,  format: "FIO banka",            accountIban: fio.accountIban };
    const tb   = parseTatraBanka(doc); if (tb) return { rows: tb.rows, format: "Tatra banka / generický SK formát", accountIban: tb.accountIban };
    return { error: "Formát XML nebol rozpoznaný. Podporované: CAMT.053, FIO banka, Tatra banka." };
}

// ─── Matching ─────────────────────────────────────────────────────────────────

const normalizeVS = (s: string) => {
    const stripped = s.replace(/\s/g, "");
    const asNum = parseInt(stripped, 10);
    return isNaN(asNum) ? stripped : String(asNum);
};

export function scoreMatch(tx: Tx, inv: InvoiceOption): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    if (inv.type !== (tx.amount > 0 ? "issued" : "received")) return { score: 0, reasons: [] };
    if (tx.variableSymbol) {
        const vs  = normalizeVS(tx.variableSymbol);
        const num = normalizeVS(inv.invoiceNumber);
        if (vs === num)                                { score += 100; reasons.push("VS = číslo faktúry"); }
        else if (num.endsWith(vs) || vs.endsWith(num)) { score += 60;  reasons.push("VS čiastočne zodpovedá číslu faktúry"); }
        else if (num.includes(vs) || vs.includes(num)) { score += 40;  reasons.push("VS obsiahnuté v čísle faktúry"); }
    }
    const abs = Math.abs(tx.amount);
    if      (Math.abs(abs - inv.grossTotal) < 0.02)                                          { score += 50; reasons.push("Suma zodpovedá (s DPH)"); }
    else if (Math.abs(abs - inv.netTotal)   < 0.02)                                          { score += 35; reasons.push("Suma zodpovedá (bez DPH)"); }
    else if (inv.grossTotal > 0 && Math.abs(abs - inv.grossTotal) / inv.grossTotal < 0.005)  { score += 30; reasons.push("Suma takmer zodpovedá (±0.5%)"); }
    return { score, reasons };
}

export function buildSuggestions(transactions: Tx[], invoices: InvoiceOption[]): MatchSuggestion[] {
    const result: MatchSuggestion[] = [];
    for (const tx of transactions.filter(t => !t.linkedInvoiceId)) {
        let best: MatchSuggestion | null = null;
        for (const inv of invoices) {
            const { score, reasons } = scoreMatch(tx, inv);
            if (score >= 50 && (!best || score > best.score)) best = { tx, invoice: inv, score, reasons };
        }
        if (best) result.push(best);
    }
    return result;
}

export function toInvoiceOption(inv: any, type: "issued" | "received"): InvoiceOption {
    const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
    const party = type === "issued" ? tryParse(inv.customer) : tryParse(inv.supplier);
    const items: any[] = tryParse(inv.items) ?? [];
    const netTotal   = items.reduce((s, it) => s + (it.lineExtensionAmount ?? 0), 0);
    const grossTotal = items.reduce((s, it) => {
        const net = it.lineExtensionAmount ?? 0;
        const vat = it.item?.classifiedTaxCategory?.percent ?? 0;
        return s + net * (1 + vat / 100);
    }, 0);
    return { id: inv.id, invoiceNumber: inv.invoiceNumber, issueDate: inv.issueDate, partyName: party?.partyName ?? "", netTotal, grossTotal, currency: inv.currency, type };
}
