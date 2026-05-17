import { Company } from "../database/entities/company";
import { dbManager } from "../database/database-manager";
import { handle } from "./ipcHandle";

export const registerCompanyIpc = () => {

    handle("company:get", async (configId: string) => {
        const db = await dbManager.getDB(configId);

        return db.getRepository(Company).findOne({ where: {} });
    });

    handle("company:create", async (configId: string, company: any) => {
        const db = await dbManager.getDB(configId);

        const repo = db.getRepository(Company);
        return repo.save({ ...company, ico: company.ico?.replace(/\s/g, "") });
    });

    handle("company:update", async (configId: string, company: any) => {
        const db = await dbManager.getDB(configId);

        const repo = db.getRepository(Company);
        const { id, ...data } = company;
        await repo.update(id, { ...data, ico: data.ico?.replace(/\s/g, "") });
        return repo.findOneBy({ id });
    });
};
