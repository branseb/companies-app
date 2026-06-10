import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { handle } from './ipcHandle'
import { adminDb, isPortalEnabled } from '../firebase/admin'

type EmployeeData = { name: string; address?: string | null; defaultLocation?: string | null; defaultFuelConsumption?: number | null; defaultEcv?: string | null }
type EmployeeRecord = { id: number | string } & EmployeeData
type Store = Record<string, EmployeeRecord[]>

const filePath = () => path.join(app.getPath('userData'), 'employees.json')

const readStore = (): Store => {
    try {
        const p = filePath()
        if (!fs.existsSync(p)) return {}
        return JSON.parse(fs.readFileSync(p, 'utf-8'))
    } catch { return {} }
}

const writeStore = (store: Store) =>
    fs.writeFileSync(filePath(), JSON.stringify(store, null, 2), 'utf-8')

const nextId = (list: EmployeeRecord[]) =>
    list.length ? Math.max(...list.map(e => Number(e.id) || 0)) + 1 : 1

const empCol = (configId: string) =>
    adminDb().collection('companies').doc(configId).collection('employees')

const toFirestore = (data: EmployeeData) => ({
    name:                   data.name,
    address:                data.address                ?? null,
    defaultLocation:        data.defaultLocation        ?? null,
    defaultFuelConsumption: data.defaultFuelConsumption ?? null,
    defaultEcv:             data.defaultEcv             ?? null,
})

export const registerEmployeesIpc = () => {

    handle('employee:byCompany', async (configId: string) => {
        if (isPortalEnabled(configId)) {
            const snap = await empCol(configId).orderBy('name', 'asc').get()
            return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        }
        const store = readStore()
        return (store[configId] ?? []).sort((a, b) => String(a.name).localeCompare(String(b.name), 'sk'))
    })

    handle('employee:create', async (configId: string, data: EmployeeData) => {
        if (isPortalEnabled(configId)) {
            const ref = await empCol(configId).add(toFirestore(data))
            return { id: ref.id, ...data }
        }
        const store = readStore()
        const list = store[configId] ?? []
        const emp: EmployeeRecord = { id: nextId(list), ...data }
        store[configId] = [...list, emp]
        writeStore(store)
        return emp
    })

    handle('employee:update', async (configId: string, id: number | string, data: EmployeeData) => {
        if (isPortalEnabled(configId)) {
            await empCol(configId).doc(String(id)).update(toFirestore(data) as any)
            return true
        }
        const store = readStore()
        store[configId] = (store[configId] ?? []).map(e => String(e.id) === String(id) ? { ...e, ...data } : e)
        writeStore(store)
        return true
    })

    handle('employee:delete', async (configId: string, id: number | string) => {
        if (isPortalEnabled(configId)) {
            await empCol(configId).doc(String(id)).delete()
            return true
        }
        const store = readStore()
        store[configId] = (store[configId] ?? []).filter(e => String(e.id) !== String(id))
        writeStore(store)
        return true
    })
}

// Migruje lokálnych zamestnancov do Firestore (volaná z portal:migrate)
export const migrateEmployeesToFirestore = async (configId: string) => {
    const store = readStore()
    const list = store[configId] ?? []
    let migrated = 0
    for (const emp of list) {
        await empCol(configId).add(toFirestore(emp))
        migrated++
    }
    return migrated
}
