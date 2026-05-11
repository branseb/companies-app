import { ipcMain } from "electron";
import { DataSource } from "typeorm";
import { Company } from "../database/entities/company";

export const registerCompanyIpc = (db: DataSource) => {

    ipcMain.handle("companies:get", async () => {
        const repo = db.getRepository(Company);
        return repo.find();
    });

    ipcMain.handle("company:add", async (_e: any, company: any) => {
        const repo = db.getRepository(Company);
        return repo.save(company);
    });
};