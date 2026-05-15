import type { EN16931Invoice } from "../models/EN16931Invoice";
import type { SimpleInvoice } from "../models/SimpleInvoice";
import { toISODate } from "./IsoDate";

export function mapToEN16931(data: SimpleInvoice): EN16931Invoice {
    const net = data.items?.reduce(
        (sum, i) => sum + i.quantity * i.unitPrice,
        0
    ) ?? 0;

    const tax = data.items?.reduce(
        (sum, i) => sum + (i.quantity * i.unitPrice * i.taxRate) / 100,
        0
    ) ?? 0;

    return {
        customizationID: "urn:cen.eu:en16931:2017",
        profileID: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",

        id: data.invoiceNumber,
        issueDate: toISODate(data.issueDate),
        dueDate: toISODate(data.dueDate),
        invoiceTypeCode: "380",
        documentCurrencyCode: data.currency,
        delivery: {
            actualDeliveryDate:
                data.delivery?.actualDeliveryDate
                && toISODate(data.delivery?.actualDeliveryDate)
        },
        paymentMeans: {
            paymentMeansCode: '31',
            paymentID: data.invoiceNumber,
        },
        accountingSupplierParty: {
            partyName: data.supplier.name,
            postalAddress: {
                streetName: data.supplier.address ?? '',
                cityName: data.supplier.city ?? '',
                postalZone: data.supplier.zip ?? '',
                country: data.supplier.country ?? ''
            },
            partyLegalEntity: {
                companyID: data.supplier.ico ?? ''
            },
            partyTaxScheme: { companyID: data.supplier.icDph ?? '' }
        },

        accountingCustomerParty: {
            partyName: data.customer.name,
            postalAddress: {
                streetName: data.customer.address ?? '',
                cityName: data.customer.city ?? '',
                postalZone: data.customer.zip ?? '',
                country: data.customer.country ?? 'SK'
            },
            partyLegalEntity: {
                companyID: data.customer.ico ?? ''
            }
        },

        taxTotal: [
            {
                taxAmount: tax,
                taxSubtotal: [
                    {
                        taxableAmount: net,
                        taxAmount: tax,
                        taxCategory: {
                            id: "S",
                            percent: data.items?.[0]?.taxRate ?? 23,
                            taxScheme: { id: "VAT" }
                        }
                    }
                ]
            }
        ],

        legalMonetaryTotal: {
            lineExtensionAmount: net,
            taxExclusiveAmount: net,
            taxInclusiveAmount: net + tax,
            payableAmount: net + tax
        },

        invoiceLine: (data.items ?? []).map((item, index) => ({
            id: String(index + 1),
            invoicedQuantity: item.quantity,
            lineExtensionAmount: item.quantity * item.unitPrice,
            item: {
                name: item.description,
                classifiedTaxCategory: {
                    id: "S",
                    percent: item.taxRate,
                    taxScheme: { id: "VAT" }
                }
            },
            price: {
                priceAmount: item.unitPrice
            }
        }))
    };
}