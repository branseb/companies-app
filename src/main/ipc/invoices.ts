import { In } from "typeorm";
import { Invoice } from "../database/entities/invoice";
import { Company } from "../database/entities/company";
import { handle } from "./ipcHandle";
import { logAction } from "./auditLog";
import { dbManager } from "../database/database-manager";
import { today } from "@e-companies/shared";

export const registerInvoiceIpc = () => {

    const stripIco = (ico?: string) => ico?.replace(/\s/g, "") ?? "";

    handle("invoice:create", async (configId: string, faktura) => {
        const db = await dbManager.getDB(configId);
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

        const saved = await repo.save(invoice);
        await logAction(db, supplierIco, "create", "invoice", saved.id, { invoiceNumber: saved.invoiceNumber });
        return saved;
    });

    handle("invoice:get", async (configId: string, id: number) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(Invoice).findOne({ where: { id }, relations: ["company"] });
    });

    const getCompanyIcos = async (db: any, companyId: number): Promise<string[]> => {
        const company = await db.getRepository(Company).findOneBy({ id: companyId });
        if (!company) return [];
        const prev: string[] = JSON.parse(company.previousIcos ?? '[]');
        return [company.ico, ...prev].filter(Boolean);
    };

    handle("invoice:by-company", async (configId: string, companyId: number) => {
        const db = await dbManager.getDB(configId);
        const icos = await getCompanyIcos(db, companyId);
        if (!icos.length) return [];
        return db.getRepository(Invoice).find({
            where: { supplierIco: In(icos) },
            relations: ["company"],
        });
    });

    handle("invoice:by-supplier-ico", async (configId: string, supplierIco: string) => {
        const db = await dbManager.getDB(configId);
        return db.getRepository(Invoice).find({
            where: { supplierIco: stripIco(supplierIco) },
        });
    });

    handle("invoice:by-customer", async (configId: string, companyId: number) => {
        const db = await dbManager.getDB(configId);
        const icos = await getCompanyIcos(db, companyId);
        if (!icos.length) return [];
        return db.getRepository(Invoice).find({
            where: { customerIco: In(icos) },
            relations: ["company"],
        });
    });

    handle("invoice:update", async (configId: string, id: number, faktura) => {
        const db = await dbManager.getDB(configId);
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
        await logAction(db, "", "update", "invoice", id, { invoiceNumber: faktura.id });
    });

    handle("invoice:delete", async (configId: string, id: number) => {
        const db = await dbManager.getDB(configId);
        await logAction(db, "", "delete", "invoice", id, {});
        return db.getRepository(Invoice).delete(id);
    });

    handle("invoice:mark-paid", async (configId: string, id: number, paid: boolean) => {
        const db = await dbManager.getDB(configId);
        const repo = db.getRepository(Invoice);
        const paidDate = paid ? today() : undefined;
        await repo.update(id, { paid, paidDate: paidDate ?? (null as any) });
        await logAction(db, "", paid ? "paid" : "unpaid", "invoice", id, {});
    });

    handle("invoice:known-parties", async (configId: string) => {
        const db = await dbManager.getDB(configId);
        const invoices = db.getRepository(Invoice).find({ select: ["supplier", "customer"] });
        const map = new Map<string, object>();
        for (const inv of await invoices) {
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

    handle("invoice:next-df-id", async (configId: string) => {
        const db = await dbManager.getDB(configId);
        const repo = db.getRepository(Invoice);
        const year = new Date().getFullYear().toString();
        const prefix = `DF${year}`;
        const invoices = await repo.find({ select: ["invoiceNumber"] });
        const numbers = invoices
            .map(inv => inv.invoiceNumber)
            .filter(Boolean)
            .filter(num => num.startsWith(prefix))
            .map(num => {
                const match = num.match(/^DF\d{4}(\d{4})$/);
                return match ? parseInt(match[1], 10) : 0;
            });
        const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
        return `${prefix}${String(next).padStart(4, '0')}`;
    });

    handle("invoice:next-id", async (configId: string, supplierIco: string) => {
        const db = await dbManager.getDB(configId);

        const repo = db.getRepository(Invoice);
        const invoices = await repo.find({ where: { supplierIco }, select: ["invoiceNumber"] });
        const year = new Date().getFullYear().toString();
        const numbers = invoices
            .map(inv => inv.invoiceNumber)
            .filter(Boolean)
            .filter(num => num.startsWith(year))
            .map(num => {
                const match = num.match(/^(\d{4})(\d{4})$/);
                return match ? parseInt(match[2], 10) : 0;
            });
        const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
        return `${year}${String(next).padStart(4, "0")}`;
    });
};
