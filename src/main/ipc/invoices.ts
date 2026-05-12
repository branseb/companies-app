import { ipcMain } from "electron";
import { DataSource } from "typeorm";
import { Invoice } from "../database/entities/invoice";

export const registerInvoiceIpc = (db: DataSource) => {

    ipcMain.handle("invoice:create", async (_event, faktura) => {
        const repo = db.getRepository(Invoice);
        const invoice = repo.create({
            invoiceNumber: faktura.id, // alebo generátor
            issueDate: faktura.issueDate,
            dueDate: faktura.dueDate,
            currency: faktura.documentCurrencyCode,
            supplierIco:
                faktura.accountingSupplierParty.partyLegalEntity.companyID,

            items: JSON.stringify(faktura.invoiceLine),
            supplier: JSON.stringify(faktura.accountingSupplierParty),
            customer: JSON.stringify(faktura.accountingCustomerParty),
            //createdAt: new Date().toISOString(),
        });

        return await repo.save(invoice);
    });

    ipcMain.handle("invoice:get", async (_event, id: number) => {
        return db.getRepository(Invoice).findOne({
            where: { id },
            relations: ["company"],
        });
    });


    ipcMain.handle("invoice:by-company", async (_event, supplierIco: string) => {
        return db.getRepository(Invoice).find({
            where: { supplierIco },
            relations: ["company"]
        });
    });

    ipcMain.handle("invoice:next-id", async (_event, supplierIco: string) => {
        const repo = db.getRepository(Invoice);

        const invoices = await repo.find({
            where: {
                supplierIco,
            },
            select: ["invoiceNumber"],
        });

        const year = new Date().getFullYear().toString();

        const numbers = invoices
            .map((inv) => inv.invoiceNumber)
            .filter(Boolean)
            .filter((num) => num.startsWith(year))
            .map((num) => {
                const match = num.match(/^(\d{4})(\d{4})$/);

                return match
                    ? parseInt(match[2], 10)
                    : 0;
            });

        const max = numbers.length
            ? Math.max(...numbers)
            : 0;

        const next = max + 1;

        return `${year}${String(next).padStart(4, "0")}`;
    });
};