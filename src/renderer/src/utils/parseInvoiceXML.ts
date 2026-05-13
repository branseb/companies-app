import type { EN16931Invoice, InvoiceLine, Party, TaxSubtotal } from "../models/EN16931Invoice";

/** Strip namespace prefixes (cbc:, cac:, rsm:, ram: ...) so querySelector works normally. */
function stripNs(xml: string): string {
    return xml
        .replace(/<(\/?)\s*[\w]+:([\w])/g, "<$1$2")   // opening/closing tags
        .replace(/\s[\w]+:([\w]+=["'])/g, " $1");      // attributes with prefix
}

function num(el: Element | null, selector: string): number {
    return parseFloat(el?.querySelector(selector)?.textContent ?? "0") || 0;
}

function str(el: Element | null, selector: string): string {
    return el?.querySelector(selector)?.textContent?.trim() ?? "";
}

function parseParty(el: Element | null): Party {
    const country = str(el, "Country IdentificationCode") || str(el, "IdentificationCode");
    return {
        partyName: str(el, "PartyName Name") || str(el, "Name"),
        postalAddress: {
            streetName: str(el, "PostalAddress StreetName"),
            cityName:   str(el, "PostalAddress CityName"),
            postalZone: str(el, "PostalAddress PostalZone"),
            country,
        },
        partyLegalEntity: { companyID: str(el, "PartyLegalEntity CompanyID") },
        partyTaxScheme:   { companyID: str(el, "PartyTaxScheme CompanyID") },
        contact: {
            electronicMail: str(el, "Contact ElectronicMail") || undefined,
            telephone:      str(el, "Contact Telephone") || undefined,
        },
        endpointID: str(el, "EndpointID") || undefined,
    };
}

function parseLines(doc: Document): InvoiceLine[] {
    return [...doc.querySelectorAll("InvoiceLine")].map(line => {
        const taxCat = line.querySelector("ClassifiedTaxCategory");
        return {
            id:                   str(line, "ID"),
            invoicedQuantity:     parseFloat(line.querySelector("InvoicedQuantity")?.textContent ?? "1") || 1,
            lineExtensionAmount:  num(line, "LineExtensionAmount"),
            item: {
                name: str(line, "Item Name"),
                classifiedTaxCategory: {
                    id:      str(taxCat, "ID"),
                    percent: num(taxCat, "Percent"),
                    taxScheme: { id: "VAT" },
                },
            },
            price: { priceAmount: num(line, "Price PriceAmount") },
        };
    });
}

function parseTaxTotals(doc: Document) {
    return [...doc.querySelectorAll("TaxTotal")].map(tt => ({
        taxAmount: num(tt, "TaxAmount"),
        taxSubtotal: [...tt.querySelectorAll("TaxSubtotal")].map((sub): TaxSubtotal => {
            const cat = sub.querySelector("TaxCategory");
            return {
                taxableAmount: num(sub, "TaxableAmount"),
                taxAmount:     num(sub, "TaxAmount"),
                taxCategory: {
                    id:      str(cat, "ID"),
                    percent: num(cat, "Percent"),
                    taxScheme: { id: "VAT" },
                },
            };
        }),
    }));
}

// ── UBL 2.1 ──────────────────────────────────────────────────────────────────

function parseUBL(doc: Document): EN16931Invoice | null {
    const root = doc.querySelector("Invoice");
    if (!root) return null;

    const supplierEl = root.querySelector("AccountingSupplierParty Party");
    const customerEl = root.querySelector("AccountingCustomerParty Party");

    return {
        customizationID:         str(root, "CustomizationID"),
        profileID:               str(root, "ProfileID") || undefined,
        id:                      str(root, "ID"),
        issueDate:               str(root, "IssueDate"),
        dueDate:                 str(root, "DueDate") || undefined,
        invoiceTypeCode:         str(root, "InvoiceTypeCode"),
        documentCurrencyCode:    str(root, "DocumentCurrencyCode"),
        note:                    str(root, "Note") || undefined,
        buyerReference:          str(root, "BuyerReference") || undefined,
        delivery: {
            actualDeliveryDate:  str(root, "Delivery ActualDeliveryDate") || undefined,
        },
        paymentMeans: {
            paymentMeansCode:    str(root, "PaymentMeans PaymentMeansCode"),
            paymentID:           str(root, "PaymentMeans PaymentID") || undefined,
            payeeFinancialAccount: {
                iban:            str(root, "PaymentMeans PayeeFinancialAccount ID"),
                bic:             str(root, "PaymentMeans PayeeFinancialAccount FinancialInstitutionBranch ID") || undefined,
            },
        },
        paymentTerms:            str(root, "PaymentTerms Note") || undefined,
        accountingSupplierParty: parseParty(supplierEl),
        accountingCustomerParty: parseParty(customerEl),
        taxTotal:                parseTaxTotals(doc),
        legalMonetaryTotal: {
            lineExtensionAmount: num(root, "LegalMonetaryTotal LineExtensionAmount"),
            taxExclusiveAmount:  num(root, "LegalMonetaryTotal TaxExclusiveAmount"),
            taxInclusiveAmount:  num(root, "LegalMonetaryTotal TaxInclusiveAmount"),
            payableAmount:       num(root, "LegalMonetaryTotal PayableAmount"),
        },
        invoiceLine: parseLines(doc),
    };
}

// ── UN/CEFACT CII ─────────────────────────────────────────────────────────────

function parseCII(doc: Document): EN16931Invoice | null {
    const root = doc.querySelector("CrossIndustryInvoice");
    if (!root) return null;

    const exDoc  = root.querySelector("ExchangedDocument");
    const header = root.querySelector("ExchangedDocumentContext");
    const trade  = root.querySelector("SupplyChainTradeTransaction");
    if (!exDoc || !trade) return null;

    const agreement  = trade.querySelector("ApplicableHeaderTradeAgreement");
    const delivery   = trade.querySelector("ApplicableHeaderTradeDelivery");
    const settlement = trade.querySelector("ApplicableHeaderTradeSettlement");

    const supplierEl = agreement?.querySelector("SellerTradeParty");
    const customerEl = agreement?.querySelector("BuyerTradeParty");

    const parseCIIParty = (el: Element | null): Party => ({
        partyName: str(el, "Name"),
        postalAddress: {
            streetName: str(el, "PostalTradeAddress LineOne"),
            cityName:   str(el, "PostalTradeAddress CityName"),
            postalZone: str(el, "PostalTradeAddress PostcodeCode"),
            country:    str(el, "PostalTradeAddress CountryID"),
        },
        partyLegalEntity: { companyID: str(el, "SpecifiedLegalOrganization ID") },
        partyTaxScheme:   { companyID: str(el, "SpecifiedTaxRegistration ID") },
    });

    const lines: InvoiceLine[] = [...(trade?.querySelectorAll("IncludedSupplyChainTradeLineItem") ?? [])].map((line, i) => {
        const prod = line.querySelector("SpecifiedTradeProduct");
        const lineAgreement = line.querySelector("SpecifiedLineTradeAgreement");
        const lineDelivery  = line.querySelector("SpecifiedLineTradeDelivery");
        const lineSettlement = line.querySelector("SpecifiedLineTradeSettlement");
        const taxCat = lineSettlement?.querySelector("ApplicableTradeTax") ?? null;
        return {
            id:                  str(line, "AssociatedDocumentLineDocument LineID") || String(i + 1),
            invoicedQuantity:    parseFloat(lineDelivery?.querySelector("BilledQuantity")?.textContent ?? "1") || 1,
            lineExtensionAmount: num(lineSettlement, "SpecifiedTradeSettlementLineMonetarySummation LineTotalAmount"),
            item: {
                name: str(prod, "Name"),
                classifiedTaxCategory: {
                    id:      str(taxCat, "CategoryCode"),
                    percent: num(taxCat, "RateApplicablePercent"),
                    taxScheme: { id: "VAT" },
                },
            },
            price: { priceAmount: num(lineAgreement, "NetPriceProductTradePrice ChargeAmount") },
        };
    });

    const taxTotals = [...(settlement?.querySelectorAll("ApplicableTradeTax") ?? [])];
    const summation = settlement?.querySelector("SpecifiedTradeSettlementHeaderMonetarySummation") ?? null;

    return {
        customizationID:         str(header, "GuidelineSpecifiedDocumentContextParameter ID"),
        id:                      str(exDoc, "ID"),
        issueDate:               str(exDoc, "IssueDateTime DateTimeString"),
        invoiceTypeCode:         str(exDoc, "TypeCode"),
        documentCurrencyCode:    str(settlement, "InvoiceCurrencyCode"),
        note:                    str(exDoc, "IncludedNote Content") || undefined,
        delivery: {
            actualDeliveryDate:  str(delivery, "ActualDeliverySupplyChainEvent OccurrenceDateTime DateTimeString") || undefined,
        },
        paymentMeans: {
            paymentMeansCode:    str(settlement, "SpecifiedTradeSettlementPaymentMeans TypeCode"),
            payeeFinancialAccount: {
                iban:            str(settlement, "SpecifiedTradeSettlementPaymentMeans PayeePartyCreditorFinancialAccount IBANID"),
            },
        },
        accountingSupplierParty: parseCIIParty(supplierEl ?? null),
        accountingCustomerParty: parseCIIParty(customerEl ?? null),
        taxTotal: taxTotals.length > 0 ? [{
            taxAmount: num(summation, "TaxTotalAmount"),
            taxSubtotal: taxTotals.map((tax): TaxSubtotal => ({
                taxableAmount: num(tax, "BasisAmount"),
                taxAmount:     num(tax, "CalculatedAmount"),
                taxCategory: {
                    id:      str(tax, "CategoryCode"),
                    percent: num(tax, "RateApplicablePercent"),
                    taxScheme: { id: "VAT" },
                },
            })),
        }] : [],
        legalMonetaryTotal: {
            lineExtensionAmount: num(summation, "LineTotalAmount"),
            taxExclusiveAmount:  num(summation, "TaxBasisTotalAmount"),
            taxInclusiveAmount:  num(summation, "GrandTotalAmount"),
            payableAmount:       num(summation, "DuePayableAmount"),
        },
        invoiceLine: lines,
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

export type ParsedInvoiceXML =
    | { invoice: EN16931Invoice; format: string }
    | { error: string };

export function parseInvoiceXML(text: string): ParsedInvoiceXML {
    const parser = new DOMParser();
    const doc = parser.parseFromString(stripNs(text), "application/xml");

    if (doc.querySelector("parsererror")) return { error: "Neplatný XML súbor" };

    const ubl = parseUBL(doc);
    if (ubl?.id) return { invoice: ubl, format: "UBL 2.1 (EN16931)" };

    const cii = parseCII(doc);
    if (cii?.id) return { invoice: cii, format: "UN/CEFACT CII (EN16931)" };

    return { error: "Formát nebol rozpoznaný. Podporované formáty: UBL 2.1, UN/CEFACT CII (EN16931)." };
}
