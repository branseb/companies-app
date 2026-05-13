import { contextBridge, ipcRenderer } from 'electron';
import { Invoice } from '../main/database/entities/invoice';

contextBridge.exposeInMainWorld("api", {
  invoice: {
    create: (data: Invoice) => ipcRenderer.invoke("invoice:create", data),
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
  company: {
    get: () => ipcRenderer.invoke("companies:get"),
    add: (data: any) => ipcRenderer.invoke("company:add", data),
    update: (data: any) => ipcRenderer.invoke("company:update", data),
  },
  bankAccount: {
    byCompany: (companyId: number) => ipcRenderer.invoke("bankAccount:by-company", companyId),
    create: (data: any) => ipcRenderer.invoke("bankAccount:create", data),
    update: (data: { id: number; name: string; note?: string }) => ipcRenderer.invoke("bankAccount:update", data),
    delete: (id: number) => ipcRenderer.invoke("bankAccount:delete", id),
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