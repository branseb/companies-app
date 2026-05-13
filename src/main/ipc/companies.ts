import { ipcMain } from "electron";
import { DataSource } from "typeorm";
import { Company } from "../database/entities/company";

export const registerCompanyIpc = async (db: DataSource) => {
    // Normalize existing ICOs with spaces in the DB
    await db.query(`UPDATE company SET ico = REPLACE(REPLACE(ico, ' ', ''), '\t', '') WHERE ico LIKE '% %'`);
    await db.query(`UPDATE invoice SET "supplierIco" = REPLACE(REPLACE("supplierIco", ' ', ''), '\t', '') WHERE "supplierIco" LIKE '% %'`);
    await db.query(`UPDATE invoice SET "customerIco" = REPLACE(REPLACE("customerIco", ' ', ''), '\t', '') WHERE "customerIco" LIKE '% %'`);

    ipcMain.handle("companies:get", async () => {
        const repo = db.getRepository(Company);
        return repo.find();
    });

    ipcMain.handle("company:add", async (_e: any, company: any) => {
        const repo = db.getRepository(Company);
        return repo.save({ ...company, ico: company.ico?.replace(/\s/g, "") });
    });

    ipcMain.handle("company:update", async (_e: any, company: any) => {
        const repo = db.getRepository(Company);
        const { id, ...data } = company;
        await repo.update(id, { ...data, ico: data.ico?.replace(/\s/g, "") });
        return repo.findOneBy({ id });
    });
};