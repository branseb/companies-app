import { BankAccount } from "../database/entities/bankAccount";
import { Company } from "../database/entities/company";
import { dbManager } from "../database/database-manager";
import { handle } from "./ipcHandle";

export const registerBankAccountIpc = () => {
    handle("bankAccount:by-company", async (configId: string, companyId: number) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(BankAccount).find({
            where: { company: { id: companyId } },
            order: { id: "ASC" },
        });
    });

    handle("bankAccount:create", async (configId: string, data: { name: string; iban?: string; currency: string; companyId: number }) => {
        const db = await dbManager.getDB(configId);
        const company = await db.getRepository(Company).findOneBy({ id: data.companyId });
        if (!company) throw new Error("Firma nenájdená");
        const account = db.getRepository(BankAccount).create({ name: data.name, iban: data.iban || undefined, currency: data.currency, company });
        return await db.getRepository(BankAccount).save(account);
    });

    handle("bankAccount:update", async (configId: string, data: { id: number; name: string; note?: string }) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(BankAccount).update(data.id, { name: data.name, note: data.note || undefined });
    });

    handle("bankAccount:delete", async (configId: string, id: number) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(BankAccount).delete(id);
    });
};
