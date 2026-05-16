import { ipcMain } from "electron";
import { CashRegister } from "../database/entities/cashRegister";
import { CashEntry } from "../database/entities/cashEntry";
import { Company } from "../database/entities/company";
import { Invoice } from "../database/entities/invoice";
import { BankTransaction } from "../database/entities/bankTransaction";
import { dbManager } from "../database/database-manager";

export const registerCashIpc = () => {
    // ── Cash registers ────────────────────────────────────────────────────────

    ipcMain.handle("cashRegister:by-company", async (_event, companyId: number) => {
        return dbManager.current.getRepository(CashRegister).find({
            where: { company: { id: companyId } },
            order: { id: "ASC" },
        });
    });

    ipcMain.handle("cashRegister:create", async (_event, data: { name: string; currency: string; companyId: number }) => {
        const db = dbManager.current;
        const company = await db.getRepository(Company).findOneBy({ id: data.companyId });
        if (!company) throw new Error("Firma nenájdená");
        const reg = db.getRepository(CashRegister).create({ name: data.name, currency: data.currency, company });
        return await db.getRepository(CashRegister).save(reg);
    });

    ipcMain.handle("cashRegister:update", async (_event, data: { id: number; name: string; note?: string }) => {
        return dbManager.current.getRepository(CashRegister).update(data.id, { name: data.name, note: data.note || undefined });
    });

    ipcMain.handle("cashRegister:delete", async (_event, id: number) => {
        return dbManager.current.getRepository(CashRegister).delete(id);
    });

    // ── Cash entries ──────────────────────────────────────────────────────────

    ipcMain.handle("cashEntry:by-company", async (_event, companyId: number) => {
        return dbManager.current.getRepository(CashEntry).find({
            where: { company: { id: companyId } },
            order: { date: "DESC", id: "DESC" },
        });
    });

    ipcMain.handle("cashEntry:create", async (_event, data: Partial<CashEntry> & { companyId: number }) => {
        const db = dbManager.current;
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
        return await db.getRepository(CashEntry).save(entry);
    });

    ipcMain.handle("cashEntry:update", async (_event, data: Partial<CashEntry> & { id: number }) => {
        const { id, ...rest } = data;
        return dbManager.current.getRepository(CashEntry).update(id, rest);
    });

    ipcMain.handle("cashEntry:link-invoice", async (_event, id: number, invoiceId: number | null) => {
        const db = dbManager.current;
        const prev = await db.getRepository(CashEntry).findOneBy({ id });
        await db.getRepository(CashEntry).update(id, { linkedInvoiceId: invoiceId ?? (null as any) });
        if (invoiceId) {
            await db.getRepository(Invoice).update(invoiceId, { paid: true, paidDate: prev?.date ?? new Date().toISOString().split("T")[0] });
        } else if (prev?.linkedInvoiceId) {
            await db.getRepository(Invoice).update(prev.linkedInvoiceId, { paid: false, paidDate: null as any });
        }
    });

    ipcMain.handle("cashEntry:pair-bank-transaction", async (_event, cashEntryId: number, bankTransactionId: number | null) => {
        const db = dbManager.current;
        const prev = await db.getRepository(CashEntry).findOneBy({ id: cashEntryId });
        if (prev?.pairedBankTransactionId) {
            await db.getRepository(BankTransaction).update(prev.pairedBankTransactionId, { pairedCashEntryId: null as any });
        }
        await db.getRepository(CashEntry).update(cashEntryId, { pairedBankTransactionId: bankTransactionId ?? (null as any) });
        if (bankTransactionId) {
            await db.getRepository(BankTransaction).update(bankTransactionId, { pairedCashEntryId: cashEntryId });
        }
    });

    ipcMain.handle("cashEntry:delete", async (_event, id: number) => {
        const db = dbManager.current;
        const entry = await db.getRepository(CashEntry).findOneBy({ id });
        if (entry?.linkedInvoiceId) await db.getRepository(Invoice).update(entry.linkedInvoiceId, { paid: false, paidDate: null as any });
        if (entry?.pairedBankTransactionId) await db.getRepository(BankTransaction).update(entry.pairedBankTransactionId, { pairedCashEntryId: null as any });
        return db.getRepository(CashEntry).delete(id);
    });
};
