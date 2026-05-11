import { BrowserWindow, ipcMain } from "electron";

export const registerWindowIpc = (win: BrowserWindow) => {
    ipcMain.on("window:close", () => {
        win.close();
    });

    ipcMain.on("window:minimize", () => {
        win.minimize();
    });

    ipcMain.on("window:maximize", () => {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    });

    ipcMain.on("window:devtools", () => {
        win.webContents.toggleDevTools();
    });
}
