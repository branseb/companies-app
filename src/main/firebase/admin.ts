import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { app as electronApp } from 'electron'
import path from 'path'
import fs from 'fs'

export const SERVICE_ACCOUNT_PATH = () =>
    path.join(electronApp.getPath('userData'), 'firebase-service-account.json')

export const SETTINGS_PATH = () =>
    path.join(electronApp.getPath('userData'), 'firebase-settings.json')

export function isFirebaseConfigured(): boolean {
    return fs.existsSync(SERVICE_ACCOUNT_PATH())
}

export function getPortalUrl(): string {
    try {
        const s = JSON.parse(fs.readFileSync(SETTINGS_PATH(), 'utf-8'))
        return s.portalUrl || 'https://e-companies-portal.vercel.app'
    } catch {
        return 'https://e-companies-portal.vercel.app'
    }
}

export function setPortalUrl(url: string): void {
    let settings: Record<string, unknown> = {}
    try { settings = JSON.parse(fs.readFileSync(SETTINGS_PATH(), 'utf-8')) } catch { /* first run */ }
    fs.writeFileSync(SETTINGS_PATH(), JSON.stringify({ ...settings, portalUrl: url }, null, 2))
}

export function isPortalEnabled(configId: string): boolean {
    if (!isFirebaseConfigured()) return false
    try {
        const s = JSON.parse(fs.readFileSync(SETTINGS_PATH(), 'utf-8'))
        return s.portalEnabled?.[configId] === true
    } catch { return false }
}

export function setPortalEnabled(configId: string, enabled: boolean): void {
    let settings: Record<string, unknown> = {}
    try { settings = JSON.parse(fs.readFileSync(SETTINGS_PATH(), 'utf-8')) } catch { /* first run */ }
    const portalEnabled = (settings.portalEnabled as Record<string, boolean> | undefined) ?? {}
    portalEnabled[configId] = enabled
    fs.writeFileSync(SETTINGS_PATH(), JSON.stringify({ ...settings, portalEnabled }, null, 2))
}

function ensureInitialized(): void {
    if (getApps().length > 0) return
    if (!isFirebaseConfigured()) throw new Error('Firebase nie je nakonfigurovaný')
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH(), 'utf-8'))
    initializeApp({ credential: cert(serviceAccount) })
}

export function adminDb() {
    ensureInitialized()
    return getFirestore()
}

export function adminAuth() {
    ensureInitialized()
    return getAuth()
}

export { FieldValue, Timestamp }
