import { Company } from "./models/company";
import { CompanyConfig } from "./models/companyConfig";

declare global {
	interface Window {
		api: {
			invoice: {
				create: (configId: string, data: any) => Promise<any>;
				update: (configId: string, id: number, data: any) => Promise<void>;
				get: (configId: string, id: string) => Promise<any>;
				nextId: (configId: string, supplierIco: string) => Promise<string>;
				nextDfId: (configId: string) => Promise<string>;
				byCompany: (configId: string, ico: string) => Promise<any[]>;
				byCustomer: (configId: string, ico: string) => Promise<any[]>;
				knownParties: (configId: string) => Promise<any[]>;
				markPaid: (configId: string, id: number, paid: boolean) => Promise<void>;
				delete: (configId: string, id: number) => Promise<void>;
			};

			db: {
				list: () => Promise<CompanyConfig[]>;
				add: (config: Omit<CompanyConfig, "id">) => Promise<CompanyConfig>;
				update: (config: CompanyConfig) => Promise<CompanyConfig>;
				delete: (id: string) => Promise<void>;
				connect: (config: CompanyConfig) => Promise<Company>;
				test: (connectionString: string) => Promise<{ success: boolean; error?: string }>;
			};

			company: {
				get: (configId: string) => Promise<Company>;
				create: (configId: string, data: Company) => Promise<Company>;
				update: (configId: string, data: Company) => Promise<Company>;
			};

			bankAccount: {
				byCompany: (configId: string, companyId: number) => Promise<any[]>;
				create: (configId: string, data: any) => Promise<any>;
				update: (configId: string, data: { id: number; name: string; note?: string }) => Promise<void>;
				delete: (configId: string, id: number) => Promise<void>;
			};

			bankTransaction: {
				create: (configId: string, data: any) => Promise<any>;
				bulkImport: (configId: string, rows: any[], companyId: number, bankAccountId?: number) => Promise<{ saved: number; skipped: number }>;
				byCompany: (configId: string, companyId: number) => Promise<any[]>;
				updateNote: (configId: string, id: number, note: string) => Promise<void>;
				linkInvoice: (configId: string, id: number, invoiceId: number | null) => Promise<void>;
				delete: (configId: string, id: number) => Promise<void>;
			};

			cashRegister: {
				byCompany: (configId: string, companyId: number) => Promise<any[]>;
				create: (configId: string, data: any) => Promise<any>;
				update: (configId: string, data: { id: number; name: string; note?: string }) => Promise<void>;
				delete: (configId: string, id: number) => Promise<void>;
			};

			cashEntry: {
				byCompany: (configId: string, companyId: number) => Promise<any[]>;
				create: (configId: string, data: any) => Promise<any>;
				update: (configId: string, data: any) => Promise<void>;
				linkInvoice: (configId: string, id: number, invoiceId: number | null) => Promise<void>;
				pairBankTransaction: (configId: string, id: number, bankTransactionId: number | null) => Promise<void>;
				delete: (configId: string, id: number) => Promise<void>;
			};

			auditLog: {
				byCompany: (configId: string, companyIco: string) => Promise<any[]>;
			};

			backup: {
				export: (configId: string, companyId: number) => Promise<string>;
			};

			notification: {
				show: (title: string, body: string) => Promise<void>;
			};

			invite: {
				isConfigured: () => Promise<boolean>;
				setup:        () => Promise<{ success: boolean; error?: string }>;
				getPortalUrl: () => Promise<string>;
				setPortalUrl: (url: string) => Promise<void>;
				create:       (companyId: string, companyName: string) => Promise<{ code: string; link: string }>;
				list:         () => Promise<any[]>;
				delete:       (inviteId: string) => Promise<void>;
				revokeAccess: (uid: string) => Promise<void>;
				deleteUser:   (uid: string) => Promise<void>;
				getUser:      (uid: string) => Promise<{ email: string | null; displayName: string | null }>;
			};
		};
		electron: {
			platform: string;
			window: {
				close: () => void;
				minimize: () => void;
				maximize: () => void;
				devtools: () => void;
			};
			pdf: {
				download: (configId: string, invoiceId: string) => Promise<string>;
				open: (filePath: string) => void;
			};
			document: {
				save:              (fileName: string, base64: string, docType: string, companyName: string) => Promise<string>;
				getFolder:         () => Promise<string>;
				setFolder:         () => Promise<string | null>;
				openCompanyFolder: (companyName: string) => Promise<void>;
				readFile:          (filePath: string) => Promise<string>;

				parseInvoice:      (base64: string) => Promise<{
					invoiceNumber: string; issueDate: string; dueDate: string; deliveryDate?: string;
					currency: string;
					supplierName: string; supplierIco: string; supplierDic: string; supplierIcDph: string;
					supplierAddress?: string; supplierZip?: string; supplierCity?: string;
					customerName: string; customerIco: string; customerDic: string;
					customerAddress?: string; customerZip?: string; customerCity?: string;
					totalAmount: number; vatAmount: number; taxRate: number;
					parsedItems?: Array<{ description: string; quantity: number; unit?: string; unitPrice: number; taxRate: number }>;
					_rawText?: string;
					_source?: 'isdoc' | 'regex';
				}>;
			};
		};
	}
}
