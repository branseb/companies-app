export interface SimpleInvoice {
  invoiceNumber: string;

  issueDate: string;
  dueDate: string;

  delivery?: {
    actualDeliveryDate?: string;
  };

  currency: string;

  supplier: Party;
  customer: Party;

  items: InvoiceItem[];

  note?: string;
  variableSymbol?: string;
  constantSymbol?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;

  unit?: string; // ks, hod, kg...
  discount?: number;
}

export interface Party {
  name: string;
  ico?: string;
  dic?: string;
  icDph?: string;

  address?: string;
  city?: string;
  zip?: string;
  country?: string;

  email?: string;
  phone?: string;
}