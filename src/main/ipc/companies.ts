import { ipcMain } from "electron";
import { Company } from "../db/entities/company.js";
import { DataSource } from "typeorm";

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