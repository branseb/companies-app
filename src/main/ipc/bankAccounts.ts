import { ipcMain } from "electron";
import { BankAccount } from "../database/entities/bankAccount";
import { Company } from "../database/entities/company";
import { dbManager } from "../database/database-manager";

export const registerBankAccountIpc = () => {
    ipcMain.handle("bankAccount:by-company", async (_event, companyId: number) => {
        return dbManager.current.getRepository(BankAccount).find({
            where: { company: { id: companyId } },
            order: { id: "ASC" },
        });
    });

    ipcMain.handle("bankAccount:create", async (_event, data: { name: string; iban?: string; currency: string; companyId: number }) => {
        const db = dbManager.current;
        const company = await db.getRepository(Company).findOneBy({ id: data.companyId });
        if (!company) throw new Error("Company not found");
        const account = db.getRepository(BankAccount).create({ name: data.name, iban: data.iban || undefined, currency: data.currency, company });
        return await db.getRepository(BankAccount).save(account);
    });

    ipcMain.handle("bankAccount:update", async (_event, data: { id: number; name: string; note?: string }) => {
        return dbManager.current.getRepository(BankAccount).update(data.id, { name: data.name, note: data.note || undefined });
    });

    ipcMain.handle("bankAccount:delete", async (_event, id: number) => {
        return dbManager.current.getRepository(BankAccount).delete(id);
    });
};
