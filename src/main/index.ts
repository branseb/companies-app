import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerInvoiceIpc } from './ipc/invoices';
import { registerCompanyIpc } from './ipc/companies';
import { registerCompanyConfigIpc } from './ipc/companyConfig';
import { registerPdfIpc } from './ipc/pdf';
import { registerWindowIpc } from './ipc/window';
import { registerBankTransactionIpc } from './ipc/bankTransactions';
import { registerBankAccountIpc } from './ipc/bankAccounts';
import { registerCashIpc } from './ipc/cash';
import { dbManager } from './database/database-manager';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  return win;
}

app.whenReady().then(async () => {
  registerCompanyConfigIpc();
  registerCompanyIpc();
  registerInvoiceIpc();
  registerPdfIpc();
  registerBankTransactionIpc();
  registerBankAccountIpc();
  registerCashIpc();
  const win = createWindow();
  registerWindowIpc(win);
});

app.on('window-all-closed', async () => {
  await dbManager.destroyAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
