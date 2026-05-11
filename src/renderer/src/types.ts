import { Company } from "./models/company";

declare global {
	interface Window {
		api: {
			invoice: {
				create: (data: any) => Promise<any>;
				all: () => Promise<any[]>;
				get: (id: string) => Promise<any>;
				nextId: (supplierIco: string) => Promise<string>;
				byCompany: (ico: string) => Promise<any[]>;
			};

			company: {
				get: () => Promise<Company[]>;
				add: (data: Company) => Promise<Company>;
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