import { DataSource } from "typeorm";
import { BankAccount } from "./entities/bankAccount";
import { BankTransaction } from "./entities/bankTransaction";
import { CashRegister } from "./entities/cashRegister";
import { CashEntry } from "./entities/cashEntry";
import { Company } from "./entities/company";
import { Invoice } from "./entities/invoice";
import { AuditLog } from "./entities/auditLog";
import { Receipt } from "./entities/receipt";
import { readConfigs } from "../ipc/companyConfig";

export type CompanyConfig = {
    id: string;
    name: string;
    connectionString: string;
};

const ENTITIES = [BankAccount, BankTransaction, CashRegister, CashEntry, Company, Invoice, AuditLog, Receipt];

const isMssql = (url: string) => url.startsWith("mssql://") || url.startsWith("sqlserver://");

const isAzureSql = (connectionString: string): boolean => {
    try {
        const host = new URL(connectionString).hostname.toLowerCase();
        return host.endsWith(".database.windows.net") || host.endsWith(".windows.net");
    } catch {
        return false;
    }
};

const normalizeMssqlUrl = (url: string) => url.replace(/^sqlserver:\/\//, "mssql://");

const buildDataSource = (connectionString: string): DataSource => {
    if (isMssql(connectionString)) {
        const azure = isAzureSql(connectionString);
        return new DataSource({
            type: "mssql",
            url: normalizeMssqlUrl(connectionString),
            requestTimeout: 300000,
            options: {
                encrypt: azure,
                trustServerCertificate: !azure,
                enableArithAbort: true,
                connectTimeout: 60000,
            },
            synchronize: true,
            logging: false,
            entities: ENTITIES,
        });
    }
    throw new Error("Nepodporovaný typ databázy. Použite mssql:// alebo sqlserver://");
};

class DatabaseManager {
    private _cache = new Map<string, DataSource>();

    constructor() {

    }

    public getDB = async (id: string) => {
        const cached = this._cache.get(id);
        if (cached) return cached;
        const config = readConfigs()
        const connectionString = config.find(c => c.id === id)?.connectionString
        const ds = buildDataSource(connectionString ?? '');
        await ds.initialize();
        this._cache.set(id, ds);
        return ds;
    }

    public destroyAllConnections = async () => {
        for (const ds of this._cache.values()) {
            if (ds.isInitialized) await ds.destroy().catch(() => { });
        }
        this._cache.clear();
    }
}

export const dbManager = new DatabaseManager();

export async function testConnection(connectionString: string): Promise<void> {
    const ds = buildDataSource(connectionString);
    try {
        await ds.initialize();
    } finally {
        if (ds.isInitialized) await ds.destroy().catch(() => { });
    }
}
