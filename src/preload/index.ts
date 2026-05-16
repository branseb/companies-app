import { contextBridge, ipcRenderer } from 'electron';
import { Invoice } from '../main/database/entities/invoice';

contextBridge.exposeInMainWorld("api", {
  invoice: {
    create: (data: Invoice) => ipcRenderer.invoke("invoice:create", data),
    update: (id: number, data: Invoice) => ipcRenderer.invoke("invoice:update", id, data),
    byCompany: (supplierIco: string) => ipcRenderer.invoke("invoice:by-company", supplierIco),
    byCustomer: (customerIco: string) => ipcRenderer.invoke("invoice:by-customer", customerIco),
    knownParties: () => ipcRenderer.invoke("invoice:known-parties"),
    get: (id: string) => ipcRenderer.invoke("invoice:get", id),
    nextId: (supplierIco: string) => ipcRenderer.invoke("invoice:next-id", supplierIco),
    markPaid: (id: number, paid: boolean) => ipcRenderer.invoke("invoice:mark-paid", id, paid),
    delete: (id: number) => ipcRenderer.invoke("invoice:delete", id)
  },

  firm: {
    get: (ico: string) => ipcRenderer.invoke("firm:get", ico)
  },

  db: {
    list: () => ipcRenderer.invoke("db:list"),
    add: (config: any) => ipcRenderer.invoke("db:add", config),
    update: (config: any) => ipcRenderer.invoke("db:update", config),
    delete: (id: string) => ipcRenderer.invoke("db:delete", id),
    connect: (config: any) => ipcRenderer.invoke("db:connect", config),
    test: (config: any) => ipcRenderer.invoke("db:test", config),
  },

  company: {
    get: () => ipcRenderer.invoke("company:get"),
    create: (data: any) => ipcRenderer.invoke("company:create", data),
    update: (data: any) => ipcRenderer.invoke("company:update", data),
  },

  bankAccount: {
    byCompany: (companyId: number) => ipcRenderer.invoke("bankAccount:by-company", companyId),
    create: (data: any) => ipcRenderer.invoke("bankAccount:create", data),
    update: (data: { id: number; name: string; note?: string }) => ipcRenderer.invoke("bankAccount:update", data),
    delete: (id: number) => ipcRenderer.invoke("bankAccount:delete", id),
  },
  cashRegister: {
    byCompany: (companyId: number) => ipcRenderer.invoke("cashRegister:by-company", companyId),
    create: (data: any) => ipcRenderer.invoke("cashRegister:create", data),
    update: (data: { id: number; name: string; note?: string }) => ipcRenderer.invoke("cashRegister:update", data),
    delete: (id: number) => ipcRenderer.invoke("cashRegister:delete", id),
  },
  cashEntry: {
    byCompany: (companyId: number) => ipcRenderer.invoke("cashEntry:by-company", companyId),
    create: (data: any) => ipcRenderer.invoke("cashEntry:create", data),
    update: (data: any) => ipcRenderer.invoke("cashEntry:update", data),
    linkInvoice: (id: number, invoiceId: number | null) => ipcRenderer.invoke("cashEntry:link-invoice", id, invoiceId),
    pairBankTransaction: (id: number, bankTransactionId: number | null) => ipcRenderer.invoke("cashEntry:pair-bank-transaction", id, bankTransactionId),
    delete: (id: number) => ipcRenderer.invoke("cashEntry:delete", id),
  },
  bankTransaction: {
    create: (data: any) => ipcRenderer.invoke("bankTransaction:create", data),
    bulkImport: (rows: any[], companyId: number, bankAccountId?: number) => ipcRenderer.invoke("bankTransaction:bulk-import", rows, companyId, bankAccountId),
    byCompany: (companyId: number) => ipcRenderer.invoke("bankTransaction:by-company", companyId),
    updateNote: (id: number, note: string) => ipcRenderer.invoke("bankTransaction:update-note", id, note),
    linkInvoice: (id: number, invoiceId: number | null) => ipcRenderer.invoke("bankTransaction:link-invoice", id, invoiceId),
    delete: (id: number) => ipcRenderer.invoke("bankTransaction:delete", id),
  },
});

contextBridge.exposeInMainWorld("electron", {
  window: {
    close: () => ipcRenderer.send("window:close"),
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    devtools: () => ipcRenderer.send("window:devtools"),
  },
  pdf: {
    download: (invoiceId: string) => ipcRenderer.invoke("pdf:download", invoiceId),
    open: (filePath: string) => ipcRenderer.send("pdf:open", filePath),
  },
});
