import jsPDF from "jspdf";
import { generatePaymentQR } from "./qrCode.js";
import type { PdfInvoice } from "./generate.js";

type DrawDatesOptions = { x: number; y: number; width: number };

export const drawDates = async (doc: jsPDF, faktura: PdfInvoice, options: DrawDatesOptions): Promise<number> => {
    const { x, y, width } = options;
    const lh = 5;
    const pad = 4;
    const qrSize = 28;

    const rows: { label: string; value: string }[] = [
        { label: "Dátum vystavenia:", value: faktura.issueDate },
    ];
    if (faktura.dueDate)
        rows.push({ label: "Dátum splatnosti:", value: faktura.dueDate });
    if (faktura.delivery?.actualDeliveryDate)
        rows.push({ label: "Dátum dodania:", value: faktura.delivery.actualDeliveryDate });
    if (faktura.paymentMeans?.payeeFinancialAccount?.iban)
        rows.push({ label: "IBAN:", value: faktura.paymentMeans.payeeFinancialAccount.iban });
    if (faktura.paymentMeans?.payeeFinancialAccount?.bic)
        rows.push({ label: "SWIFT:", value: faktura.paymentMeans.payeeFinancialAccount.bic });

    const textHeight = rows.length * lh;
    const height = Math.max(textHeight, qrSize + lh + 4) + pad * 2;

    doc.setFillColor(235, 235, 235);
    doc.rect(x, y - pad, width, height, "F");

    doc.setFont("Roboto", "normal");
    doc.setFontSize(9);

    let cy = y;
    rows.forEach(row => {
        doc.text(row.label, x + 2, cy);
        doc.text(row.value, x + 38, cy);
        cy += lh;
    });

    // VS + QR na pravej strane
    const qrX = x + width - qrSize - 4;
    const vs = faktura.paymentMeans?.paymentID ?? faktura.id;
    doc.setFont("Roboto", "700");
    doc.text("VS: " + vs, qrX + qrSize / 2, y, { align: "center" });
    doc.setFont("Roboto", "normal");

    await drawPaymentQR(doc, faktura, qrX, y + lh);

    return y - pad + height;
};

const drawPaymentQR = async (doc: jsPDF, faktura: PdfInvoice, x: number, y: number, size = 28) => {
    const qrDataURL = await generatePaymentQR(faktura);
    if (!qrDataURL) return;
    doc.addImage(qrDataURL, "PNG", x, y, size, size);
};
