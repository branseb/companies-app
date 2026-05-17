import { app } from "electron";
import fs from "fs";
import path from "path";
import { Invoice } from "../database/entities/invoice";
import { BankTransaction } from "../database/entities/bankTransaction";
import { BankAccount } from "../database/entities/bankAccount";
import { CashEntry } from "../database/entities/cashEntry";
import { CashRegister } from "../database/entities/cashRegister";
import { Company } from "../database/entities/company";
import { dbManager } from "../database/database-manager";
import { handle } from "./ipcHandle";

export const registerBackupIpc = () => {
    handle("backup:export", async (configId: string, companyId: number) => {
        const db = await dbManager.getDB(configId);

        const [company, invoices, bankAccounts, bankTransactions, cashRegisters, cashEntries] = await Promise.all([
            db.getRepository(Company).findOneBy({ id: companyId }),
            db.getRepository(Invoice).find({ where: { company: { id: companyId } } }),
            db.getRepository(BankAccount).find({ where: { company: { id: companyId } } }),
            db.getRepository(BankTransaction).find({ where: { company: { id: companyId } } }),
            db.getRepository(CashRegister).find({ where: { company: { id: companyId } } }),
            db.getRepository(CashEntry).find({ where: { company: { id: companyId } } }),
        ]);

        const backup = {
            exportedAt: new Date().toISOString(),
            company,
            invoices,
            bankAccounts,
            bankTransactions,
            cashRegisters,
            cashEntries,
        };

        const date = new Date().toISOString().slice(0, 10);
        const safeName = (company?.name ?? "firma").replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `zaloha_${safeName}_${date}.json`;
        const filePath = path.join(app.getPath("downloads"), filename);
        fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), "utf-8");
        return filePath;
    });
};
