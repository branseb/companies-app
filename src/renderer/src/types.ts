import { Company } from "./models/company";

declare global {
	interface Window {
		api: {
			invoice: {
				create: (data: any) => Promise<any>;
				update: (id: number, data: any) => Promise<void>;
				all: () => Promise<any[]>;
				get: (id: string) => Promise<any>;
				nextId: (supplierIco: string) => Promise<string>;
				byCompany: (ico: string) => Promise<any[]>;
				byCustomer: (ico: string) => Promise<any[]>;
				knownParties: () => Promise<any[]>;
				markPaid: (id: number, paid: boolean) => Promise<void>;
				delete: (id: number) => Promise<void>;
			};

			company: {
				get: () => Promise<Company[]>;
				add: (data: Company) => Promise<Company>;
				update: (data: Company) => Promise<Company>;
			};

			bankAccount: {
				byCompany: (companyId: number) => Promise<any[]>;
				create: (data: any) => Promise<any>;
				update: (data: { id: number; name: string; note?: string }) => Promise<void>;
				delete: (id: number) => Promise<void>;
			};
			bankTransaction: {
				create: (data: any) => Promise<any>;
				bulkImport: (rows: any[], companyId: number, bankAccountId?: number) => Promise<{ saved: number; skipped: number }>;
				byCompany: (companyId: number) => Promise<any[]>;
				updateNote: (id: number, note: string) => Promise<void>;
				linkInvoice: (id: number, invoiceId: number | null) => Promise<void>;
				delete: (id: number) => Promise<void>;
			};

			cashRegister: {
				byCompany: (companyId: number) => Promise<any[]>;
				create: (data: any) => Promise<any>;
				update: (data: { id: number; name: string; note?: string }) => Promise<void>;
				delete: (id: number) => Promise<void>;
			};

			cashEntry: {
				byCompany: (companyId: number) => Promise<any[]>;
				create: (data: any) => Promise<any>;
				update: (data: any) => Promise<void>;
				linkInvoice: (id: number, invoiceId: number | null) => Promise<void>;
				pairBankTransaction: (id: number, bankTransactionId: number | null) => Promise<void>;
				delete: (id: number) => Promise<void>;
			};
		};
		electron: {
			window: {
				close: () => void;
				minimize: () => void;
				maximize: () => void;
				devtools: () => void;
			};
			pdf: {
				download: (invoiceId: string) => Promise<string>;
				open: (filePath: string) => void;
			};
		};
	}
}
