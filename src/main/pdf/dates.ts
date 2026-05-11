import jsPDF from "jspdf";
import { generatePaymentQR } from "./qrCode.js";
import type { PdfInvoice } from "./generate.js";

type DrawDatesOptions = { x: number; y: number; width: number };

export const drawDates = (doc: jsPDF, faktura: PdfInvoice, options: DrawDatesOptions) => {
    const { x, y, width } = options;
    const lineHeight = 5;
    const padding = 4;

    const rows: { label: string; value: string }[] = [];
    rows.push({ label: "Dátum vystavenia:", value: faktura.issueDate });
    if (faktura.dueDate) rows.push({ label: "Dátum splatnosti:", value: faktura.dueDate });
    if (faktura.delivery?.actualDeliveryDate)
        rows.push({ label: "Dátum dodania:", value: faktura.delivery.actualDeliveryDate });
    if (faktura.paymentMeans?.paymentMeansCode)
        rows.push({ label: "Platba:", value: faktura.paymentMeans.paymentMeansCode });
    rows.push({ label: "", value: "" });

    const account = faktura.paymentMeans?.payeeFinancialAccount;
    if (account?.iban) rows.push({ label: "IBAN:", value: account.iban });
    if (account?.bic) rows.push({ label: "SWIFT:", value: account.bic });

    const height = rows.length * lineHeight + padding * 2;
    doc.setFillColor(230, 230, 230);
    doc.rect(x, y - padding * 2, width, height, "F");

    doc.setFont("Roboto", "normal");
    doc.setFontSize(9);

    let currentY = y;
    rows.forEach((row) => {
        doc.text(row.label, x + 2, currentY);
        doc.text(row.value, x + 30, currentY);
        currentY += lineHeight;
    });

    const rowGap = 100;
    doc.text("VS:", x + rowGap + 2, y);
    doc.text(faktura.paymentMeans?.paymentID ?? faktura.id, x + rowGap + 10, y);

    drawPaymentQR(doc, faktura, x + rowGap, y + 10);

    return y + height;
};

const drawPaymentQR = async (doc: jsPDF, faktura: PdfInvoice, x: number, y: number, size = 30) => {
    const qrDataURL = await generatePaymentQR(faktura);
    if (!qrDataURL) return;
    doc.addImage(qrDataURL, "PNG", x, y, size, size);
};
