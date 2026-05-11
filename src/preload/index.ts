import { contextBridge, ipcRenderer } from 'electron';
import { Invoice } from '../main/database/entities/invoice';

contextBridge.exposeInMainWorld("api", {
  invoice: {
    create: (data: Invoice) => ipcRenderer.invoke("invoice:create", data),
    byCompany: (supplierIco: string) => ipcRenderer.invoke("invoice:by-company", supplierIco),
    get: (id: string) => ipcRenderer.invoke("invoice:get", id),
    nextId: (supplierIco: string) => ipcRenderer.invoke("invoice:next-id", supplierIco)
  },

  firm: {
    get: (ico: string) => ipcRenderer.invoke("firm:get", ico)
  },
  company: {
    get: () => ipcRenderer.invoke("companies:get"),
    add: (data: any) => ipcRenderer.invoke("company:add", data),
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