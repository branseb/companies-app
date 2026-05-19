import { dialog } from 'electron'
import fs from 'fs'
import crypto from 'crypto'
import { handle } from './ipcHandle'
import {
    isFirebaseConfigured, adminDb, adminAuth, getPortalUrl, setPortalUrl,
    SERVICE_ACCOUNT_PATH, FieldValue, Timestamp,
} from '../firebase/admin'

export const registerInviteIpc = () => {

    handle('invite:isConfigured', async () => isFirebaseConfigured())

    handle('invite:getPortalUrl', async () => getPortalUrl())

    handle('invite:setPortalUrl', async (url: string) => setPortalUrl(url))

    handle('invite:setup', async () => {
        const { filePaths } = await dialog.showOpenDialog({
            title: 'Vybrať Firebase Service Account JSON',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile'],
        })

        if (!filePaths[0]) return { success: false }

        try {
            const content = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))
            if (content.type !== 'service_account') {
                return { success: false, error: 'Súbor nie je platný Firebase Service Account' }
            }
            fs.copyFileSync(filePaths[0], SERVICE_ACCOUNT_PATH())
            return { success: true }
        } catch {
            return { success: false, error: 'Chyba pri čítaní súboru' }
        }
    })

    handle('invite:create', async (companyId: string, companyName: string) => {
        const db = adminDb()
        const code = crypto.randomUUID()
        const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

        await db.collection('invites').doc(code).set({
            companyId,
            companyName,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt,
            used: false,
            usedByUid: null,
        })

        const link = `${getPortalUrl()}/invite/${code}`
        return { code, link }
    })

    handle('invite:list', async () => {
        const db = adminDb()
        const snap = await db.collection('invites').orderBy('createdAt', 'desc').limit(20).get()
        return snap.docs.map(d => {
            const data = d.data()
            return {
                id:          d.id,
                companyId:   data.companyId,
                companyName: data.companyName,
                used:        data.used,
                usedByUid:   data.usedByUid ?? null,
                createdAt:   data.createdAt?.toDate().toISOString() ?? null,
                expiresAt:   data.expiresAt?.toDate().toISOString() ?? null,
            }
        })
    })

    handle('invite:delete', async (inviteId: string) => {
        await adminDb().collection('invites').doc(inviteId).delete()
    })

    handle('invite:revokeAccess', async (uid: string) => {
        await adminAuth().updateUser(uid, { disabled: true })
    })

    handle('invite:deleteUser', async (uid: string) => {
        await adminAuth().deleteUser(uid)
    })

    handle('invite:getUser', async (uid: string) => {
        try {
            const user = await adminAuth().getUser(uid)
            return { email: user.email ?? null, displayName: user.displayName ?? null }
        } catch {
            return { email: null, displayName: null }
        }
    })
}
