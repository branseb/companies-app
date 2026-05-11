import QRCode from "qrcode";
import type { PdfInvoice } from "./generate.js";

export const generatePaymentQR = async (faktura: PdfInvoice): Promise<string | null> => {
    const iban = faktura.paymentMeans?.payeeFinancialAccount?.iban;
    if (!iban) return null;

    const bic = faktura.paymentMeans?.payeeFinancialAccount?.bic ?? "";
    const amount = faktura.legalMonetaryTotal?.payableAmount?.toFixed(2);
    const vs = faktura.paymentMeans?.paymentID ?? faktura.id;
    const currency = faktura.documentCurrencyCode;

    const qrText = `IBAN:${iban};BIC:${bic};AMOUNT:${amount};CURRENCY:${currency};VS:${vs}`;
    return await QRCode.toDataURL(qrText, { width: 500 });
};
