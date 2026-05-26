export type InvoiceRow = {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    deliveryDate?: string;
    currency: string;
    supplier: string;
    customer: string;
    items: string;
    paid?: boolean;
    paidDate?: string;
}
