import { CashRegister } from "../database/entities/cashRegister";
import { CashEntry } from "../database/entities/cashEntry";
import { Company } from "../database/entities/company";
import { Invoice } from "../database/entities/invoice";
import { BankTransaction } from "../database/entities/bankTransaction";
import { dbManager } from "../database/database-manager";
import { handle } from "./ipcHandle";
import { logAction } from "./auditLog";
import { today } from "@e-companies/shared";

export const registerCashIpc = () => {

    handle("cashRegister:by-company", async (configId: string, companyId: number) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(CashRegister).find({
            where: { company: { id: companyId } },
            order: { id: "ASC" },
        });
    });

    handle("cashRegister:create", async (configId: string, data: { name: string; currency: string; companyId: number }) => {
        const db = await dbManager.getDB(configId);
        const company = await db.getRepository(Company).findOneBy({ id: data.companyId });
        if (!company) throw new Error("Firma nenájdená");
        const reg = db.getRepository(CashRegister).create({ name: data.name, currency: data.currency, company });
        return await db.getRepository(CashRegister).save(reg);
    });

    handle("cashRegister:update", async (configId: string, data: { id: number; name: string; note?: string }) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(CashRegister).update(data.id, { name: data.name, note: data.note || undefined });
    });

    handle("cashRegister:delete", async (configId: string, id: number) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(CashRegister).delete(id);
    });

    handle("cashEntry:by-company", async (configId: string, companyId: number) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(CashEntry).find({
            where: { company: { id: companyId } },
            order: { date: "DESC", id: "DESC" },
        });
    });

    handle("cashEntry:create", async (configId: string, data: Partial<CashEntry> & { companyId: number }) => {
        const db = await dbManager.getDB(configId);
        const company = await db.getRepository(Company).findOneBy({ id: data.companyId });
        if (!company) throw new Error("Firma nenájdená");
        const entry = db.getRepository(CashEntry).create({
            date: data.date,
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            note: data.note,
            cashRegisterId: data.cashRegisterId ?? undefined,
            linkedInvoiceId: data.linkedInvoiceId ?? undefined,
            company,
        });
        const saved = await db.getRepository(CashEntry).save(entry);
        await logAction(db, company.ico, "create", "cashEntry", saved.id, { amount: saved.amount, date: saved.date });
        return saved;
    });

    handle("cashEntry:update", async (configId: string, data: Partial<CashEntry> & { id: number }) => {
        const { id, ...rest } = data;
        const db = await dbManager.getDB(configId);

        return db.getRepository(CashEntry).update(id, rest);
    });

    handle("cashEntry:link-invoice", async (configId: string, id: number, invoiceId: number | null) => {
        const db = await dbManager.getDB(configId);
        const prev = await db.getRepository(CashEntry).findOneBy({ id });
        await db.getRepository(CashEntry).update(id, { linkedInvoiceId: invoiceId ?? (null as any) });
        if (invoiceId) {
            await db.getRepository(Invoice).update(invoiceId, { paid: true, paidDate: prev?.date ?? today() });
        } else if (prev?.linkedInvoiceId) {
            await db.getRepository(Invoice).update(prev.linkedInvoiceId, { paid: false, paidDate: null as any });
        }
    });

    handle("cashEntry:pair-bank-transaction", async (configId: string, cashEntryId: number, bankTransactionId: number | null) => {
        const db = await dbManager.getDB(configId);
        const prev = await db.getRepository(CashEntry).findOneBy({ id: cashEntryId });
        if (prev?.pairedBankTransactionId) {
            await db.getRepository(BankTransaction).update(prev.pairedBankTransactionId, { pairedCashEntryId: null as any });
        }
        await db.getRepository(CashEntry).update(cashEntryId, { pairedBankTransactionId: bankTransactionId ?? (null as any) });
        if (bankTransactionId) {
            await db.getRepository(BankTransaction).update(bankTransactionId, { pairedCashEntryId: cashEntryId });
        }
    });

    handle("cashEntry:delete", async (configId: string, id: number) => {
        const db = await dbManager.getDB(configId);
        const entry = await db.getRepository(CashEntry).findOneBy({ id });
        if (entry?.linkedInvoiceId) await db.getRepository(Invoice).update(entry.linkedInvoiceId, { paid: false, paidDate: null as any });
        if (entry?.pairedBankTransactionId) await db.getRepository(BankTransaction).update(entry.pairedBankTransactionId, { pairedCashEntryId: null as any });
        const result = await db.getRepository(CashEntry).delete(id);
        await logAction(db, "", "delete", "cashEntry", id, {});
        return result;
    });
};
