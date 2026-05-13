import { ipcMain } from "electron";
import { DataSource } from "typeorm";
import { BankTransaction } from "../database/entities/bankTransaction";
import { Invoice } from "../database/entities/invoice";
import { Company } from "../database/entities/company";

export const registerBankTransactionIpc = (db: DataSource) => {

    ipcMain.handle("bankTransaction:create", async (_event, data: Partial<BankTransaction> & { companyId: number; bankAccountId?: number }) => {
        const repo = db.getRepository(BankTransaction);
        const company = await db.getRepository(Company).findOneBy({ id: data.companyId });
        if (!company) throw new Error("Company not found");

        const tx = repo.create({
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

        return await repo.save(tx);
    });

    ipcMain.handle("bankTransaction:bulk-import", async (_event, rows: Array<Partial<BankTransaction>>, companyId: number, bankAccountId?: number) => {
        const repo = db.getRepository(BankTransaction);
        const company = await db.getRepository(Company).findOneBy({ id: companyId });
        if (!company) throw new Error("Firma nenájdená");

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
        return { saved: entities.length, skipped };
    });

    ipcMain.handle("bankTransaction:by-company", async (_event, companyId: number) => {
        return db.getRepository(BankTransaction).find({
            where: { company: { id: companyId } },
            order: { date: "DESC", id: "DESC" },
        });
    });

    ipcMain.handle("bankTransaction:update-note", async (_event, id: number, note: string) => {
        return db.getRepository(BankTransaction).update(id, { note: note || undefined });
    });

    ipcMain.handle("bankTransaction:link-invoice", async (_event, id: number, invoiceId: number | null) => {
        const prev = await db.getRepository(BankTransaction).findOneBy({ id });
        await db.getRepository(BankTransaction).update(id, { linkedInvoiceId: invoiceId ?? (null as any) });
        if (invoiceId) {
            await db.getRepository(Invoice).update(invoiceId, { paid: true, paidDate: prev?.date ?? new Date().toISOString().split("T")[0] });
        } else if (prev?.linkedInvoiceId) {
            await db.getRepository(Invoice).update(prev.linkedInvoiceId, { paid: false, paidDate: null as any });
        }
    });

    ipcMain.handle("bankTransaction:delete", async (_event, id: number) => {
        const tx = await db.getRepository(BankTransaction).findOneBy({ id });
        if (tx?.linkedInvoiceId) await db.getRepository(Invoice).update(tx.linkedInvoiceId, { paid: false, paidDate: null as any });
        return db.getRepository(BankTransaction).delete(id);
    });
};
