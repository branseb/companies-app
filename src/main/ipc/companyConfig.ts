import { app, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { Company } from "../database/entities/company";
import { CompanyConfig, dbManager } from "../database/database-manager";

const configPath = () => path.join(app.getPath("userData"), "companies.json");

const readConfigs = (): CompanyConfig[] => {
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
    ipcMain.handle("db:list", () => readConfigs());

    ipcMain.handle("db:add", (_e, config: Omit<CompanyConfig, "id">) => {
        const configs = readConfigs();
        const newConfig: CompanyConfig = { ...config, id: Date.now().toString() };
        configs.push(newConfig);
        writeConfigs(configs);
        return newConfig;
    });

    ipcMain.handle("db:update", (_e, config: CompanyConfig) => {
        const configs = readConfigs();
        const idx = configs.findIndex(c => c.id === config.id);
        if (idx === -1) throw new Error("Config not found");
        configs[idx] = config;
        writeConfigs(configs);
        return config;
    });

    ipcMain.handle("db:delete", (_e, id: string) => {
        writeConfigs(readConfigs().filter(c => c.id !== id));
    });

    ipcMain.handle("db:connect", async (_e, config: CompanyConfig) => {
        await dbManager.connect(config);
        const repo = dbManager.current.getRepository(Company);
        let company = await repo.findOne({ where: {}, order: { id: "ASC" } });
        if (!company) {
            company = await repo.save({ name: config.name, ico: "" });
        }
        return company;
    });

    ipcMain.handle("db:test", async (_e, connectionString: string) => {
        try {
            await dbManager.testConnection(connectionString);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });
};
