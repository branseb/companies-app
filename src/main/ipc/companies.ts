import { Company } from "../database/entities/company";
import { AuditLog } from "../database/entities/auditLog";
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
        const newIco = data.ico?.replace(/\s/g, "") ?? data.ico;

        const existing = await repo.findOneBy({ id });
        const oldIco = existing?.ico

        let previousIcos = data.previousIcos
        if (oldIco && newIco && oldIco !== newIco) {
            const prev: string[] = JSON.parse(existing?.previousIcos ?? '[]')
            if (!prev.includes(oldIco)) prev.push(oldIco)
            previousIcos = JSON.stringify(prev)

            await db.getRepository(AuditLog).createQueryBuilder()
                .update().set({ companyIco: newIco })
                .where('companyIco = :old', { old: oldIco })
                .execute()
        }

        await repo.update(id, { ...data, ico: newIco, previousIcos });

        return repo.findOneBy({ id });
    });
};
