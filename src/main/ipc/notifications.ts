import { Notification } from 'electron'
import { handle } from './ipcHandle'

export const registerNotificationsIpc = () => {
    handle('notification:show', async (title: string, body: string) => {
        if (Notification.isSupported()) {
            new Notification({ title, body }).show()
        }
    })
}
