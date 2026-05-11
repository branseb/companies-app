import { app, BrowserWindow } from 'electron';
import path from 'path';
import { createDataSource } from './database/data-source';
import { registerInvoiceIpc } from './ipc/invoices';
import { registerCompanyIpc } from './ipc/companies';
import { registerPdfIpc } from './ipc/pdf';
import { registerWindowIpc } from './ipc/window';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.toggleDevTools()

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  return win;
}

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath("userData"), "app.db");

  const db = createDataSource(dbPath);
  await db.initialize();
  registerInvoiceIpc(db);
  registerCompanyIpc(db);
  registerPdfIpc(db);
  const win = createWindow();
  registerWindowIpc(win);
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
