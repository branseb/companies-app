import { ipcMain } from "electron";

export function handle(channel: string, fn: (...args: any[]) => Promise<any>) {
    ipcMain.handle(channel, async (_event, ...args) => {
        try {
            return await fn(...args);
        } catch (err: any) {
            console.error(`[IPC] ${channel}:`, err?.message ?? err);
            throw new Error(err?.message ?? String(err));
        }
    });
}
