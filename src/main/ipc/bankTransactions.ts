import { BankTransaction } from "../database/entities/bankTransaction";
import { Invoice } from "../database/entities/invoice";
import { Company } from "../database/entities/company";
import { CashEntry } from "../database/entities/cashEntry";
import { handle } from "./ipcHandle";
import { logAction } from "./auditLog";
import { dbManager } from "../database/database-manager";
import { today } from "@e-companies/shared";

export const registerBankTransactionIpc = () => {

    handle("bankTransaction:create", async (configId: string, data: Partial<BankTransaction> & { companyId: number; bankAccountId?: number }) => {
        const db = await dbManager.getDB(configId);
        const company = await db.getRepository(Company).findOneBy({ id: data.companyId });
        if (!company) throw new Error("Firma nenájdená");

        const tx = db.getRepository(BankTransaction).create({
            date: data.date,
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            counterpartyName: data.counterpartyName,
            counterpartyIban: data.counterpartyIban,
            variableSymbol: data.variableSymbol,
            constantSymbol: data.constantSymbol,
            specificSymbol: data.specificSymbol,
            note: data.note,
            bankAccountId: data.bankAccountId ?? undefined,
            company,
        });

        const saved = await db.getRepository(BankTransaction).save(tx);
        await logAction(db, company.ico, "create", "bankTransaction", saved.id, { amount: saved.amount, date: saved.date });
        return saved;
    });

    handle("bankTransaction:bulk-import", async (configId: string, rows: Array<Partial<BankTransaction>>, companyId: number, bankAccountId?: number) => {
        const db = await dbManager.getDB(configId);
        const company = await db.getRepository(Company).findOneBy({ id: companyId });
        if (!company) throw new Error("Firma nenájdená");

        const repo = db.getRepository(BankTransaction);
        const existing = await repo.find({
            where: { company: { id: companyId } },
            select: ["date", "amount", "variableSymbol", "counterpartyIban"],
        });
        const fp = (r: Pick<BankTransaction, "date" | "amount" | "variableSymbol" | "counterpartyIban">) =>
            `${r.date}|${r.amount}|${r.variableSymbol ?? ""}|${r.counterpartyIban ?? ""}`;
        const existingSet = new Set(existing.map(fp));

        const entities = rows
            .map(r => repo.create({ ...r, company, bankAccountId: bankAccountId ?? undefined }))
            .filter(e => !existingSet.has(fp(e)));

        const skipped = rows.length - entities.length;
        if (entities.length) await repo.save(entities);
        await logAction(db, company.ico, "bulk-import", "bankTransaction", undefined, { saved: entities.length, skipped });
        return { saved: entities.length, skipped };
    });

    handle("bankTransaction:by-company", async (configId: string, companyId: number) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(BankTransaction).find({
            where: { company: { id: companyId } },
            order: { date: "DESC", id: "DESC" },
        });
    });

    handle("bankTransaction:update-note", async (configId: string, id: number, note: string) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(BankTransaction).update(id, { note: note || undefined });
    });

    handle("bankTransaction:link-invoice", async (configId: string, id: number, invoiceId: number | null) => {
        const db = await dbManager.getDB(configId);
        const prev = await db.getRepository(BankTransaction).findOneBy({ id });
        await db.getRepository(BankTransaction).update(id, { linkedInvoiceId: invoiceId ?? (null as any) });
        if (invoiceId) {
            await db.getRepository(Invoice).update(invoiceId, { paid: true, paidDate: prev?.date ?? today() });
        } else if (prev?.linkedInvoiceId) {
            await db.getRepository(Invoice).update(prev.linkedInvoiceId, { paid: false, paidDate: null as any });
        }
    });

    handle("bankTransaction:delete", async (configId: string, id: number) => {
        const db = await dbManager.getDB(configId);
        const tx = await db.getRepository(BankTransaction).findOneBy({ id });
        if (tx?.linkedInvoiceId) await db.getRepository(Invoice).update(tx.linkedInvoiceId, { paid: false, paidDate: null as any });
        if (tx?.pairedCashEntryId) await db.getRepository(CashEntry).update(tx.pairedCashEntryId, { pairedBankTransactionId: null as any });
        const result = await db.getRepository(BankTransaction).delete(id);
        await logAction(db, "", "delete", "bankTransaction", id, {});
        return result;
    });
};
