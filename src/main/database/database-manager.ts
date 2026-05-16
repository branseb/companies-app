import { DataSource } from "typeorm";
import { BankAccount } from "./entities/bankAccount";
import { BankTransaction } from "./entities/bankTransaction";
import { CashRegister } from "./entities/cashRegister";
import { CashEntry } from "./entities/cashEntry";
import { Company } from "./entities/company";
import { Invoice } from "./entities/invoice";

export type CompanyConfig = {
    id: string;
    name: string;
    connectionString: string;
};

const ENTITIES = [BankAccount, BankTransaction, CashRegister, CashEntry, Company, Invoice];

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

const buildDataSource = (connectionString: string, extraEntities = ENTITIES): DataSource => {
    if (isMssql(connectionString)) {
        const azure = isAzureSql(connectionString);
        return new DataSource({
            type: "mssql",
            url: normalizeMssqlUrl(connectionString),
            options: {
                encrypt: azure ? true : false,
                trustServerCertificate: azure ? false : true,
                enableArithAbort: true,
            },
            synchronize: true,
            logging: false,
            entities: extraEntities,
        });
    }
    throw new Error("Nepodporovaný typ databázy. Použite mssql:// alebo sqlserver://");
};

class DatabaseManager {
    private _current: DataSource | null = null;
    private _cache = new Map<string, DataSource>();

    get current(): DataSource {
        if (!this._current?.isInitialized) throw new Error("Žiadne aktívne pripojenie k databáze");
        return this._current;
    }

    get isConnected(): boolean {
        return this._current?.isInitialized === true;
    }

    async connect(config: CompanyConfig): Promise<void> {
        const cached = this._cache.get(config.id);
        if (cached?.isInitialized) {
            this._current = cached;
            return;
        }
        const ds = buildDataSource(config.connectionString);
        await ds.initialize();
        this._cache.set(config.id, ds);
        this._current = ds;
    }

    async testConnection(connectionString: string): Promise<void> {
        const ds = buildDataSource(connectionString, []);
        try {
            await ds.initialize();
        } finally {
            if (ds.isInitialized) await ds.destroy().catch(() => {});
        }
    }

    async destroyAll(): Promise<void> {
        for (const ds of this._cache.values()) {
            if (ds.isInitialized) await ds.destroy().catch(() => {});
        }
        this._cache.clear();
        this._current = null;
    }
}

export const dbManager = new DatabaseManager();
