import { ipcMain } from "electron";
import { DataSource } from "typeorm";
import { Invoice } from "../database/entities/invoice";

export const registerInvoiceIpc = (db: DataSource) => {

    const stripIco = (ico?: string) => ico?.replace(/\s/g, "") ?? "";

    ipcMain.handle("invoice:create", async (_event, faktura) => {
        const repo = db.getRepository(Invoice);
        const supplierIco = stripIco(faktura.accountingSupplierParty.partyLegalEntity?.companyID);

        const existing = await repo.findOneBy({ invoiceNumber: faktura.id, supplierIco });
        if (existing) throw new Error(`Faktúra č. ${faktura.id} pre IČO ${supplierIco} už existuje v databáze`);

        const invoice = repo.create({
            invoiceNumber: faktura.id,
            issueDate: faktura.issueDate,
            dueDate: faktura.dueDate,
            currency: faktura.documentCurrencyCode,
            supplierIco,
            customerIco: stripIco(faktura.accountingCustomerParty.partyLegalEntity?.companyID),
            deliveryDate: faktura.delivery?.actualDeliveryDate,

            items: JSON.stringify(faktura.invoiceLine),
            supplier: JSON.stringify(faktura.accountingSupplierParty),
            customer: JSON.stringify(faktura.accountingCustomerParty),
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
            where: { supplierIco: stripIco(supplierIco) },
            relations: ["company"]
        });
    });

    ipcMain.handle("invoice:by-customer", async (_event, customerIco: string) => {
        return db.getRepository(Invoice).find({
            where: { customerIco: stripIco(customerIco) },
            relations: ["company"]
        });
    });

    ipcMain.handle("invoice:update", async (_event, id: number, faktura) => {
        await db.getRepository(Invoice).update(id, {
            invoiceNumber: faktura.id,
            issueDate: faktura.issueDate,
            dueDate: faktura.dueDate,
            currency: faktura.documentCurrencyCode,
            deliveryDate: faktura.delivery?.actualDeliveryDate ?? (null as any),
            items: JSON.stringify(faktura.invoiceLine),
            supplier: JSON.stringify(faktura.accountingSupplierParty),
            customer: JSON.stringify(faktura.accountingCustomerParty),
            supplierIco: stripIco(faktura.accountingSupplierParty.partyLegalEntity?.companyID),
            customerIco: stripIco(faktura.accountingCustomerParty.partyLegalEntity?.companyID),
        });
    });

    ipcMain.handle("invoice:delete", async (_event, id: number) => {
        return db.getRepository(Invoice).delete(id);
    });

    ipcMain.handle("invoice:mark-paid", async (_event, id: number, paid: boolean) => {
        const repo = db.getRepository(Invoice);
        const paidDate = paid ? new Date().toISOString().split("T")[0] : undefined;
        await repo.update(id, { paid, paidDate: paidDate ?? (null as any) });
    });

    ipcMain.handle("invoice:known-parties", async () => {
        const invoices = await db.getRepository(Invoice).find({ select: ["supplier", "customer"] });
        const map = new Map<string, object>();

        for (const inv of invoices) {
            for (const jsonStr of [inv.supplier, inv.customer]) {
                try {
                    const p = JSON.parse(jsonStr);
                    const ico: string = p.partyLegalEntity?.companyID;
                    if (!ico || map.has(ico)) continue;
                    map.set(ico, {
                        name: p.partyName ?? "",
                        ico,
                        icDph: p.partyTaxScheme?.companyID ?? "",
                        address: p.postalAddress?.streetName ?? "",
                        city: p.postalAddress?.cityName ?? "",
                        zip: p.postalAddress?.postalZone ?? "",
                        country: p.postalAddress?.country ?? "",
                    });
                } catch { }
            }
        }

        return Array.from(map.values());
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