import { DataSource } from "typeorm";
import { AuditLog } from "../database/entities/auditLog";
import { dbManager } from "../database/database-manager";
import { handle } from "./ipcHandle";

export async function logAction(
    db: DataSource,
    companyIco: string,
    action: string,
    entityType: string,
    entityId?: number,
    details?: object
) {
    try {
        await db.getRepository(AuditLog).save({
            companyIco,
            action,
            entityType,
            entityId,
            details: details ? JSON.stringify(details) : undefined,
        });
    } catch {
        // audit log failures must not break the main operation
    }
}

export const registerAuditLogIpc = () => {
    handle("auditLog:by-company", async (configId: string, companyIco: string) => {
        const db = await dbManager.getDB(configId)
        return db.getRepository(AuditLog).find({
            where: { companyIco },
            order: { createdAt: "DESC" },
            take: 500,
        });
    });
};
