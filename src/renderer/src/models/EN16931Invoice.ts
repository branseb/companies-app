// ==============================
// EN 16931 Invoice Model (TS)
// ==============================

export type EN16931Invoice = {
    // --- ZÁKLAD ---
    customizationID: string;        // napr. "urn:cen.eu:en16931:2017"
    profileID?: string;             // napr. PEPPOL profil

    id: string;                     // BT-1
    issueDate: string;              // BT-2
    dueDate?: string;               // BT-9
    invoiceTypeCode: string;        // BT-3 (380 = invoice)

    documentCurrencyCode: string;   // BT-5

    note?: string;                  // BT-22

    // 🔥 DOPLNENÉ (dôležité pre štát)
    buyerReference?: string;        // BT-10 (často povinné pre B2G)
    delivery?: {
        actualDeliveryDate?: string; // BT-72
    };
    // --- STRANY ---
    accountingSupplierParty: Party;
    accountingCustomerParty: Party;

    // --- PLATBA ---
    paymentMeans?: PaymentMeans;
    paymentTerms?: string;          // BT-20 (napr. "Splatnosť 14 dní")

    // --- DPH ---
    taxTotal: TaxTotal[];

    // --- SUMY ---
    legalMonetaryTotal: LegalMonetaryTotal;

    // --- POLOŽKY ---
    invoiceLine: InvoiceLine[];
}

// ==============================
// PARTY (Dodávateľ / Odberateľ)
// ==============================

export type Party = {
    partyName: string;

    postalAddress: Address;

    partyTaxScheme?: {
        companyID: string; // IČ DPH (BT-31 / BT-48)
    };

    partyLegalEntity?: {
        companyID: string; // IČO
    };

    contact?: {
        name?: string;
        electronicMail?: string;
        telephone?: string;
    };

    endpointID?: string; // PEPPOL ID (dôležité pre eInvoicing)
}

// ==============================
// ADRESA
// ==============================

export type Address = {
    streetName: string;
    cityName: string;
    postalZone: string;
    country: string; // "SK"
}

// ==============================
// PLATBA
// ==============================

export type PaymentMeans = {
    paymentMeansCode: string; // "31" = bank transfer (BT-81)

    payeeFinancialAccount?: {
        iban: string;
        bic?: string;           // SWIFT/BIC (BT-84)
    };

    paymentID?: string;       // BT-83 (variabilný symbol)
}

// ==============================
// DPH (Tax)
// ==============================

export type TaxTotal = {
    taxAmount: number;

    taxSubtotal: TaxSubtotal[];
}

export type TaxSubtotal = {
    taxableAmount: number;
    taxAmount: number;

    taxCategory: {
        id: string;        // "S", "Z", "E"
        percent: number;   // 20, 10, 0

        taxScheme: {
            id: "VAT";
        };
    };
}

// ==============================
// SUMY
// ==============================

export type LegalMonetaryTotal = {
    lineExtensionAmount: number;   // bez DPH
    taxExclusiveAmount: number;
    taxInclusiveAmount: number;
    payableAmount: number;
}

// ==============================
// POLOŽKY
// ==============================

export type InvoiceLine = {
    id: string;

    invoicedQuantity: number;

    lineExtensionAmount: number;

    item: {
        name: string;

        classifiedTaxCategory: {
            id: string;        // "S"
            percent: number;   // 20

            taxScheme: {
                id: "VAT";
            };
        };
    };

    price: {
        priceAmount: number;
    };
}