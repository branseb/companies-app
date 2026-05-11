import jsPDF from "jspdf";
import type { Party } from "./generate.js";

type PartyOptions = {
    x: number;
    y: number;
    width?: number;
    withBorder?: boolean;
    label?: string;
};

export const drawParty = (doc: jsPDF, party: Party, options: PartyOptions) => {
    const { x, y, width = 90, withBorder = false, label = "Party" } = options;
    let startY = y;

    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.text(`${label}:`, x + 2, startY);
    startY += 6;

    doc.setFont("Roboto", "700");
    doc.text(party.partyName ?? "", x + 4, startY);
    startY += 6;

    if (party.postalAddress) {
        doc.text(party.postalAddress.streetName ?? "", x + 4, startY);
        startY += 6;
        doc.text(`${party.postalAddress.postalZone ?? ""} ${party.postalAddress.cityName ?? ""}`, x + 4, startY);
        startY += 6;
    }
    doc.setFont("Roboto", "normal");

    if (party.partyLegalEntity?.companyID) {
        doc.text("IČO:", x + 4, startY);
        doc.text(party.partyLegalEntity.companyID, x + 20, startY);
        startY += 6;
    }
    if (party.partyTaxScheme?.companyID) {
        doc.text("IČ DPH:", x + 4, startY);
        doc.text(party.partyTaxScheme.companyID, x + 20, startY);
        startY += 6;
    }

    if (withBorder) {
        const height = startY - y + 4;
        doc.setLineWidth(0.8);
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y - 6, width, height);
    }

    return startY;
};
