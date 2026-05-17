import { app } from "electron";
import fs from "fs";
import path from "path";
import { Company } from "../database/entities/company";
import { CompanyConfig, dbManager, testConnection } from "../database/database-manager";
import { handle } from "./ipcHandle";
import { ipcMain } from "electron";

const configPath = () => path.join(app.getPath("userData"), "companies.json");

export const readConfigs = (): CompanyConfig[] => {
    try {
        return JSON.parse(fs.readFileSync(configPath(), "utf-8"));
    } catch {
        return [];
    }
};

const writeConfigs = (configs: CompanyConfig[]) => {
    fs.writeFileSync(configPath(), JSON.stringify(configs, null, 2), "utf-8");
};

export const registerCompanyConfigIpc = () => {
    handle("db:list", async () => readConfigs());

    handle("db:add", async (config: Omit<CompanyConfig, "id">) => {
        const configs = readConfigs();
        const newConfig: CompanyConfig = { ...config, id: Date.now().toString() };
        configs.push(newConfig);
        writeConfigs(configs);
        return newConfig;
    });

    handle("db:update", async (config: CompanyConfig) => {
        const configs = readConfigs();
        const idx = configs.findIndex(c => c.id === config.id);
        if (idx === -1) throw new Error("Konfigurácia nenájdená");
        configs[idx] = config;
        writeConfigs(configs);
        return config;
    });

    handle("db:delete", async (id: string) => {
        writeConfigs(readConfigs().filter(c => c.id !== id));
    });

    handle("db:connect", async (config: CompanyConfig) => {
        const db = await dbManager.getDB(config.id);
        const repo = db.getRepository(Company);
        let company = await repo.findOne({ where: {}, order: { id: "ASC" } });
        if (!company) {
            company = await repo.save({ name: config.name, ico: "" });
        }
        return company;
    });

    ipcMain.handle("db:test", async (_e, connectionString: string) => {
        try {
            await testConnection(connectionString);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });
};
