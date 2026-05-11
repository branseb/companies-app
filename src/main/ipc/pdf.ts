import { app, ipcMain, shell } from "electron";
import { DataSource } from "typeorm";
import { Invoice } from "../db/entities/invoice.js";
import { buildPdfInvoice, generatePdfBase64 } from "../pdf/generate.js";
import fs from "fs";
import path from "path";

export const registerPdfIpc = (db: DataSource) => {
    ipcMain.handle("pdf:download", async (_event, invoiceId: string) => {
        const raw = await db.getRepository(Invoice).findOneOrFail({ where: { id: invoiceId } });
        const faktura = buildPdfInvoice(raw);
        const base64 = generatePdfBase64(faktura);

        const filename = `faktura${raw.invoiceNumber}.pdf`;
        const filePath = path.join(app.getPath("downloads"), filename);
        fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
        return filePath;
    });

    ipcMain.on("pdf:open", (_event, filePath: string) => {
        shell.openPath(filePath);
    });
};
