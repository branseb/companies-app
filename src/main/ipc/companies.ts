import { ipcMain } from "electron";
import { Company } from "../database/entities/company";
import { dbManager } from "../database/database-manager";

export const registerCompanyIpc = () => {
    ipcMain.handle("company:get", async () => {
        return dbManager.current.getRepository(Company).findOne({ where: {} });
    });

    ipcMain.handle("company:create", async (_e, company: any) => {
        const repo = dbManager.current.getRepository(Company);
        return repo.save({ ...company, ico: company.ico?.replace(/\s/g, "") });
    });

    ipcMain.handle("company:update", async (_e, company: any) => {
        const repo = dbManager.current.getRepository(Company);
        const { id, ...data } = company;
        await repo.update(id, { ...data, ico: data.ico?.replace(/\s/g, "") });
        return repo.findOneBy({ id });
    });
};
