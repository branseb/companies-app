import { app, shell } from "electron";
import { ipcMain } from "electron";
import { buildPdfInvoice, generatePdfBase64 } from "../pdf/generate.js";
import fs from "fs";
import path from "path";
import { Invoice } from "../database/entities/invoice.js";
import { BankAccount } from "../database/entities/bankAccount.js";
import { Company } from "../database/entities/company.js";
import { handle } from "./ipcHandle";
import { dbManager } from "../database/database-manager.js";

export const registerPdfIpc = () => {
    handle("pdf:download", async (configId: string, invoiceId: number) => {
        const db = await dbManager.getDB(configId);
        const raw = await db.getRepository(Invoice).findOneOrFail({ where: { id: invoiceId } });

        let iban: string | undefined;
        const company = await db.getRepository(Company).findOneBy({ ico: raw.supplierIco });
        if (company) {
            const accounts = await db.getRepository(BankAccount).find({
                where: { company: { id: company.id } },
                order: { id: "ASC" },
            });
            iban = accounts[0]?.iban;
        }

        const faktura = buildPdfInvoice(raw, iban);
        const base64 = await generatePdfBase64(faktura);

        const filename = `faktura_${raw.invoiceNumber}.pdf`;
        const filePath = path.join(app.getPath("downloads"), filename);
        fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
        return filePath;
    });

    ipcMain.on("pdf:open", (_event, filePath: string) => {
        shell.openPath(filePath);
    });
};
