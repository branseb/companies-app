import { jsPDF } from "jspdf";
import { drawParty } from "./party.js";
import { drawDates } from "./dates.js";
import { robotoBase64 } from "./robotoFont.js";
import { roboto700Base64 } from "./robotoBoldFont.js";

export interface Party {
    partyName: string;
    postalAddress?: { streetName?: string; cityName?: string; postalZone?: string; country?: string };
    partyLegalEntity?: { companyID: string };
    partyTaxScheme?: { companyID: string };
}

export interface InvoiceLine {
    invoicedQuantity: number;
    lineExtensionAmount: number;
    item: { name: string; classifiedTaxCategory?: { percent: number } };
    price: { priceAmount: number };
}

export interface PdfInvoice {
    id: string;
    issueDate: string;
    dueDate?: string;
    documentCurrencyCode: string;
    delivery?: { actualDeliveryDate?: string };
    paymentMeans?: {
        paymentMeansCode?: string;
        paymentID?: string;
        payeeFinancialAccount?: { iban: string; bic?: string };
    };
    accountingSupplierParty: Party;
    accountingCustomerParty: Party;
    invoiceLine: InvoiceLine[];
    legalMonetaryTotal: { payableAmount: number };
}

export const buildPdfInvoice = (raw: {
    invoiceNumber: string;
    issueDate: string;
    dueDate?: string;
    deliveryDate?: string;
    currency: string;
    items: string;
    supplier: string;
    customer: string;
}, iban?: string): PdfInvoice => {
    const invoiceLine: InvoiceLine[] = JSON.parse(raw.items);
    const net = invoiceLine.reduce((s, l) => s + l.lineExtensionAmount, 0);
    const tax = invoiceLine.reduce(
        (s, l) => s + l.lineExtensionAmount * (l.item?.classifiedTaxCategory?.percent ?? 0) / 100,
        0
    );
    return {
        id: raw.invoiceNumber,
        issueDate: raw.issueDate,
        dueDate: raw.dueDate,
        documentCurrencyCode: raw.currency,
        delivery: raw.deliveryDate ? { actualDeliveryDate: raw.deliveryDate } : undefined,
        paymentMeans: {
            paymentMeansCode: '31',
            paymentID: raw.invoiceNumber,
            ...(iban ? { payeeFinancialAccount: { iban } } : {}),
        },
        accountingSupplierParty: JSON.parse(raw.supplier),
        accountingCustomerParty: JSON.parse(raw.customer),
        invoiceLine,
        legalMonetaryTotal: { payableAmount: net + tax },
    };
};

export const generatePdfBase64 = async (faktura: PdfInvoice): Promise<string> => {
    const doc = new jsPDF();

    doc.addFileToVFS("Roboto-Regular.ttf", robotoBase64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", roboto700Base64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "700");
    doc.setFont("Roboto", "normal");

    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 10;
    const rightX = pageWidth - marginX;

    // Header
    doc.setFontSize(18);
    doc.setFont("Roboto", "700");
    doc.text("FAKTÚRA", marginX, 18);
    doc.setFontSize(12);
    doc.setFont("Roboto", "normal");
    doc.text("č. " + faktura.id, marginX, 25);

    // Parties
    const supplierY = drawParty(doc, faktura.accountingSupplierParty, { x: marginX, y: 35, label: "Dodávateľ" });
    const customerY = drawParty(doc, faktura.accountingCustomerParty, { x: 105, y: 35, label: "Odberateľ", withBorder: true });

    const datesY = Math.max(supplierY, customerY) + 8;
    const datesEndY = await drawDates(doc, faktura, { x: marginX, y: datesY, width: pageWidth - marginX * 2 });

    // Items table
    let y = datesEndY + 8;
    const lh = 7;

    const COL = {
        num:   marginX,
        name:  18,
        qty:   107,
        price: 128,
        vat:   143,
        base:  167,
        total: rightX - 2,
    };

    doc.setFontSize(8.5);
    doc.setFont("Roboto", "700");
    doc.text("#", COL.num, y);
    doc.text("Popis", COL.name, y);
    doc.text("Množ.", COL.qty, y, { align: "right" });
    doc.text("J.cena", COL.price, y, { align: "right" });
    doc.text("DPH%", COL.vat, y, { align: "right" });
    doc.text("Základ", COL.base, y, { align: "right" });
    doc.text("Spolu", COL.total, y, { align: "right" });

    y += 2;
    doc.setLineWidth(0.4);
    doc.line(marginX, y, rightX, y);
    y += lh - 2;

    doc.setFont("Roboto", "normal");

    const taxGroups = new Map<number, { taxable: number; tax: number }>();

    faktura.invoiceLine?.forEach((line, i) => {
        const rate = line.item.classifiedTaxCategory?.percent ?? 0;
        const base = line.lineExtensionAmount;
        const vat  = base * rate / 100;
        const total = base + vat;

        const maxNameWidth = COL.qty - COL.name - 2;
        const nameLines = doc.splitTextToSize(line.item.name, maxNameWidth) as string[];

        doc.text(String(i + 1),                        COL.num,   y);
        doc.text(nameLines[0],                         COL.name,  y);
        doc.text(String(line.invoicedQuantity),        COL.qty,   y, { align: "right" });
        doc.text(line.price.priceAmount.toFixed(2),    COL.price, y, { align: "right" });
        doc.text(rate + "%",                           COL.vat,   y, { align: "right" });
        doc.text(base.toFixed(2),                      COL.base,  y, { align: "right" });
        doc.text(total.toFixed(2),                     COL.total, y, { align: "right" });
        y += lh;

        const g = taxGroups.get(rate) ?? { taxable: 0, tax: 0 };
        taxGroups.set(rate, { taxable: g.taxable + base, tax: g.tax + vat });
    });

    y += 2;
    doc.setLineWidth(0.3);
    doc.line(marginX, y, rightX, y);
    y += lh;

    // Tax summary
    doc.setFontSize(8.5);
    doc.setFont("Roboto", "normal");
    taxGroups.forEach((g, rate) => {
        doc.text(`Základ DPH ${rate}%:`, COL.base,  y, { align: "right" });
        doc.text(g.taxable.toFixed(2),   COL.total, y, { align: "right" });
        y += lh - 1;
        doc.text(`DPH ${rate}%:`,        COL.base,  y, { align: "right" });
        doc.text(g.tax.toFixed(2),       COL.total, y, { align: "right" });
        y += lh - 1;
    });

    doc.setLineWidth(0.5);
    doc.line(COL.vat + 2, y, rightX, y);
    y += lh;

    doc.setFontSize(11);
    doc.setFont("Roboto", "700");
    doc.text("Celkom na úhradu:", COL.base, y, { align: "right" });
    doc.text(
        `${faktura.legalMonetaryTotal.payableAmount.toFixed(2)} ${faktura.documentCurrencyCode}`,
        COL.total, y, { align: "right" }
    );

    doc.setFontSize(7);
    doc.setFont("Roboto", "normal");
    doc.text("Ďakujeme za Vašu platbu.", pageWidth / 2, 290, { align: "center" });

    return doc.output("datauristring").split(",")[1];
};
