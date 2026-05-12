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
    dueDate: string;
    currency: string;
    items: string;
    supplier: string;
    customer: string;
}): PdfInvoice => {
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
        accountingSupplierParty: JSON.parse(raw.supplier),
        accountingCustomerParty: JSON.parse(raw.customer),
        invoiceLine,
        legalMonetaryTotal: { payableAmount: net + tax },
    };
};

export const generatePdfBase64 = (faktura: PdfInvoice): string => {
    const doc = new jsPDF();
    const setFontSize = (size: number) => doc.setFontSize(size);

    doc.addFileToVFS("Roboto-Regular.ttf", robotoBase64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", roboto700Base64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "700");
    doc.setFont("Roboto", "normal");

    const pageWidth = doc.internal.pageSize.getWidth();

    setFontSize(16);
    doc.text("FAKTÚRA č.: " + faktura.id, pageWidth / 2, 15, { align: "left" });

    const verticalOffset = 10;
    const supplierY = drawParty(doc, faktura.accountingSupplierParty, { x: 10, y: 35 + verticalOffset, label: "Dodávateľ" });
    const customerY = drawParty(doc, faktura.accountingCustomerParty, { x: 105, y: 35 + verticalOffset, label: "Odberateľ", withBorder: true });

    const datesX = 10;
    const datesY = Math.max(supplierY, customerY) + 8;
    const datesEndY = drawDates(doc, faktura, { x: datesX, y: datesY, width: pageWidth - datesX * 2 });

    let startY = datesEndY + 6;
    const lineHeight = 7;
    setFontSize(9);
    doc.setFont("Roboto", "normal");

    doc.text("Č.", 10, startY);
    doc.text("Položka", 20, startY);
    doc.text("Množstvo", 100, startY, { align: "right" });
    doc.text("Cena/jedn.", 130, startY, { align: "right" });
    doc.text("Celkom", 160, startY, { align: "right" });

    startY += 2;
    doc.setLineWidth(0.3);
    doc.line(10, startY, pageWidth - 10, startY);
    startY += lineHeight - 2;

    faktura.invoiceLine?.forEach((line, index) => {
        const total = line.invoicedQuantity * line.price.priceAmount;
        doc.text((index + 1).toString(), 10, startY);
        doc.text(line.item.name, 20, startY);
        doc.text(line.invoicedQuantity.toString(), 100, startY, { align: "right" });
        doc.text(line.price.priceAmount.toFixed(2), 130, startY, { align: "right" });
        doc.text(total.toFixed(2), 160, startY, { align: "right" });
        startY += lineHeight;
    });

    startY += 2;
    doc.line(10, startY, pageWidth - 10, startY);
    startY += lineHeight;

    setFontSize(10);
    doc.setFont("Roboto", "700");
    doc.text("Celkom na úhradu:", 130, startY, { align: "right" });
    doc.text(`${faktura.legalMonetaryTotal.payableAmount.toFixed(2)} ${faktura.documentCurrencyCode}`, 160, startY, { align: "right" });

    setFontSize(7);
    doc.setFont("Roboto", "normal");
    doc.text("Ďakujeme za Vašu platbu.", pageWidth / 2, 290, { align: "center" });

    const dataUri = doc.output("datauristring");
    return dataUri.split(",")[1];
};
