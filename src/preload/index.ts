import { contextBridge, ipcRenderer } from 'electron';
import { Invoice } from '../main/database/entities/invoice';

contextBridge.exposeInMainWorld("api", {
  invoice: {
    create: (configId: string, data: Invoice) => ipcRenderer.invoke("invoice:create", configId, data),
    update: (configId: string, id: number, data: Invoice) => ipcRenderer.invoke("invoice:update", configId, id, data),
    byCompany: (configId: string, companyId: number) => ipcRenderer.invoke("invoice:by-company", configId, companyId),
    bySupplierIco: (configId: string, supplierIco: string) => ipcRenderer.invoke("invoice:by-supplier-ico", configId, supplierIco),
    byCustomer: (configId: string, companyId: number) => ipcRenderer.invoke("invoice:by-customer", configId, companyId),
    knownParties: (configId: string) => ipcRenderer.invoke("invoice:known-parties", configId),
    get: (configId: string, id: number) => ipcRenderer.invoke("invoice:get", configId, id),
    nextId: (configId: string, supplierIco: string) => ipcRenderer.invoke("invoice:next-id", configId, supplierIco),
    nextDfId: (configId: string) => ipcRenderer.invoke("invoice:next-df-id", configId),
    markPaid: (configId: string, id: number, paid: boolean) => ipcRenderer.invoke("invoice:mark-paid", configId, id, paid),
    delete: (configId: string, id: number) => ipcRenderer.invoke("invoice:delete", configId, id),
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
    get: (configId: string) => ipcRenderer.invoke("company:get", configId),
    create: (configId: string, data: any) => ipcRenderer.invoke("company:create", configId, data),
    update: (configId: string, data: any) => ipcRenderer.invoke("company:update", configId, data),
  },

  bankAccount: {
    byCompany: (configId: string, companyId: number) => ipcRenderer.invoke("bankAccount:by-company", configId, companyId),
    create: (configId: string, data: any) => ipcRenderer.invoke("bankAccount:create", configId, data),
    update: (configId: string, data: { id: number; name: string; note?: string }) => ipcRenderer.invoke("bankAccount:update", configId, data),
    delete: (configId: string, id: number) => ipcRenderer.invoke("bankAccount:delete", configId, id),
  },

  cashRegister: {
    byCompany: (configId: string, companyId: number) => ipcRenderer.invoke("cashRegister:by-company", configId, companyId),
    create: (configId: string, data: any) => ipcRenderer.invoke("cashRegister:create", configId, data),
    update: (configId: string, data: { id: number; name: string; note?: string }) => ipcRenderer.invoke("cashRegister:update", configId, data),
    delete: (configId: string, id: number) => ipcRenderer.invoke("cashRegister:delete", configId, id),
  },

  cashEntry: {
    byCompany: (configId: string, companyId: number) => ipcRenderer.invoke("cashEntry:by-company", configId, companyId),
    create: (configId: string, data: any) => ipcRenderer.invoke("cashEntry:create", configId, data),
    update: (configId: string, data: any) => ipcRenderer.invoke("cashEntry:update", configId, data),
    linkInvoice: (configId: string, id: number, invoiceId: number | null) => ipcRenderer.invoke("cashEntry:link-invoice", configId, id, invoiceId),
    pairBankTransaction: (configId: string, id: number, bankTransactionId: number | null) => ipcRenderer.invoke("cashEntry:pair-bank-transaction", configId, id, bankTransactionId),
    delete: (configId: string, id: number) => ipcRenderer.invoke("cashEntry:delete", configId, id),
  },

  bankTransaction: {
    create: (configId: string, data: any) => ipcRenderer.invoke("bankTransaction:create", configId, data),
    bulkImport: (configId: string, rows: any[], companyId: number, bankAccountId?: number) => ipcRenderer.invoke("bankTransaction:bulk-import", configId, rows, companyId, bankAccountId),
    byCompany: (configId: string, companyId: number) => ipcRenderer.invoke("bankTransaction:by-company", configId, companyId),
    updateNote: (configId: string, id: number, note: string) => ipcRenderer.invoke("bankTransaction:update-note", configId, id, note),
    linkInvoice: (configId: string, id: number, invoiceId: number | null) => ipcRenderer.invoke("bankTransaction:link-invoice", configId, id, invoiceId),
    delete: (configId: string, id: number) => ipcRenderer.invoke("bankTransaction:delete", configId, id),
  },

  auditLog: {
    byCompany: (configId: string, companyIco: string) => ipcRenderer.invoke("auditLog:by-company", configId, companyIco),
  },

  backup: {
    export: (configId: string, companyId: number) => ipcRenderer.invoke("backup:export", configId, companyId),
  },

  notification: {
    show: (title: string, body: string) => ipcRenderer.invoke('notification:show', title, body),
  },

  receipt: {
    create:    (configId: string, companyId: number, ekasaId: string, ekasaDataJson: string, photoBase64?: string, photoFileName?: string, notes?: string) =>
                 ipcRenderer.invoke('receipt:create', configId, companyId, ekasaId, ekasaDataJson, photoBase64, photoFileName, notes),
    byCompany: (configId: string, companyId: number) => ipcRenderer.invoke('receipt:byCompany', configId, companyId),
    delete:    (configId: string, id: number) => ipcRenderer.invoke('receipt:delete', configId, id),
    loadPhoto: (configId: string, photoPath: string) => ipcRenderer.invoke('receipt:loadPhoto', configId, photoPath),
  },

  employee: {
    byCompany: (configId: string, companyId: number) => ipcRenderer.invoke('employee:byCompany', configId, companyId),
    create:    (configId: string, companyId: number, data: any) => ipcRenderer.invoke('employee:create', configId, companyId, data),
    update:    (configId: string, id: number, data: any) => ipcRenderer.invoke('employee:update', configId, id, data),
    delete:    (configId: string, id: number) => ipcRenderer.invoke('employee:delete', configId, id),
  },

  travelRates: {
    get:  () => ipcRenderer.invoke('travelRates:get'),
    save: (rates: unknown) => ipcRenderer.invoke('travelRates:save', rates),
  },

  companyRates: {
    get:  (configId: string) => ipcRenderer.invoke('companyRates:get', configId),
    save: (configId: string, rates: unknown) => ipcRenderer.invoke('companyRates:save', configId, rates),
  },

  employeeRates: {
    getAll: (configId: string) => ipcRenderer.invoke('employeeRates:getAll', configId),
    save:   (configId: string, employeeId: number | string, rates: unknown) => ipcRenderer.invoke('employeeRates:save', configId, employeeId, rates),
    delete: (configId: string, employeeId: number | string) => ipcRenderer.invoke('employeeRates:delete', configId, employeeId),
  },

  travelPreferences: {
    get:  () => ipcRenderer.invoke('travelPreferences:get'),
    save: (prefs: unknown) => ipcRenderer.invoke('travelPreferences:save', prefs),
  },

  travelOrder: {
    byCompany:   (configId: string, companyId: number) => ipcRenderer.invoke('travelOrder:byCompany', configId, companyId),
    create:      (configId: string, companyId: number, data: any) => ipcRenderer.invoke('travelOrder:create', configId, companyId, data),
    update:      (configId: string, id: any, data: any) => ipcRenderer.invoke('travelOrder:update', configId, id, data),
    delete:      (configId: string, id: any) => ipcRenderer.invoke('travelOrder:delete', configId, id),
    generatePdf: (configId: string, id: any, includeAccounting?: boolean) => ipcRenderer.invoke('travelOrder:generatePdf', configId, id, includeAccounting),
    attachment: {
      list:        (configId: string, orderId: any) => ipcRenderer.invoke('travelOrder:attachments:get', configId, orderId),
      add:         (configId: string, orderId: any) => ipcRenderer.invoke('travelOrder:attachment:add', configId, orderId),
      open:        (configId: string, orderId: any, id: string) => ipcRenderer.invoke('travelOrder:attachment:open', configId, orderId, id),
      delete:      (configId: string, orderId: any, id: string) => ipcRenderer.invoke('travelOrder:attachment:delete', configId, orderId, id),
      migrate:     (configId: string, tempId: string, realOrderId: any) => ipcRenderer.invoke('travelOrder:attachment:migrate', configId, tempId, realOrderId),
      addFromPath: (configId: string, orderId: any, filePath: string) => ipcRenderer.invoke('travelOrder:attachment:addFromPath', configId, orderId, filePath),
      read:        (configId: string, orderId: any, id: string) => ipcRenderer.invoke('travelOrder:attachment:read', configId, orderId, id),
    },
  },

  portal: {
    isEnabled:    (configId: string) => ipcRenderer.invoke('portal:isEnabled', configId),
    setEnabled:   (configId: string, enabled: boolean) => ipcRenderer.invoke('portal:setEnabled', configId, enabled),
    migrate:      (configId: string, companyId: number) => ipcRenderer.invoke('portal:migrate', configId, companyId),
    syncCompany:  (configId: string) => ipcRenderer.invoke('portal:syncCompany', configId),
    syncRates:         (configId: string, rates: unknown) => ipcRenderer.invoke('portal:syncRates', configId, rates),
    syncCompanyRates:  (configId: string, rates: unknown) => ipcRenderer.invoke('portal:syncCompanyRates', configId, rates),
  },

  invite: {
    isConfigured: () => ipcRenderer.invoke("invite:isConfigured"),
    setup:        () => ipcRenderer.invoke("invite:setup"),
    getPortalUrl: () => ipcRenderer.invoke("invite:getPortalUrl"),
    setPortalUrl: (url: string) => ipcRenderer.invoke("invite:setPortalUrl", url),
    create:       (companyId: string, companyName: string) => ipcRenderer.invoke("invite:create", companyId, companyName),
    list:         () => ipcRenderer.invoke("invite:list"),
    delete:       (inviteId: string) => ipcRenderer.invoke("invite:delete", inviteId),
    revokeAccess: (uid: string) => ipcRenderer.invoke("invite:revokeAccess", uid),
    deleteUser:   (uid: string) => ipcRenderer.invoke("invite:deleteUser", uid),
    getUser:      (uid: string) => ipcRenderer.invoke("invite:getUser", uid),
  },
});

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  window: {
    close: () => ipcRenderer.send("window:close"),
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    devtools: () => ipcRenderer.send("window:devtools"),
  },
  pdf: {
    download: (configId: string, invoiceId: number) => ipcRenderer.invoke("pdf:download", configId, invoiceId),
    open: (filePath: string) => ipcRenderer.send("pdf:open", filePath),
  },
  document: {
    save:              (fileName: string, base64: string, docType: string, companyName: string) => ipcRenderer.invoke("document:save", fileName, base64, docType, companyName),
    getFolder:         ()                  => ipcRenderer.invoke("document:getFolder"),
    setFolder:         ()                  => ipcRenderer.invoke("document:setFolder"),
    openCompanyFolder: (companyName: string) => ipcRenderer.invoke("document:openCompanyFolder", companyName),
    readFile:          (filePath: string)       => ipcRenderer.invoke("document:readFile", filePath),
    parseInvoice:      (base64: string)         => ipcRenderer.invoke("document:parseInvoice", base64),

  },
});
