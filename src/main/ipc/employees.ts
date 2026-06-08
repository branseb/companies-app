import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { handle } from './ipcHandle'

type EmployeeRecord = { id: number; name: string; address?: string; defaultLocation?: string }
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
    list.length ? Math.max(...list.map(e => e.id)) + 1 : 1

export const registerEmployeesIpc = () => {
    handle('employee:byCompany', async (configId: string) => {
        const store = readStore()
        return (store[configId] ?? []).sort((a, b) => a.name.localeCompare(b.name, 'sk'))
    })

    handle('employee:create', async (configId: string, data: { name: string; address?: string; defaultLocation?: string }) => {
        const store = readStore()
        const list = store[configId] ?? []
        const emp: EmployeeRecord = { id: nextId(list), name: data.name, address: data.address, defaultLocation: data.defaultLocation }
        store[configId] = [...list, emp]
        writeStore(store)
        return emp
    })

    handle('employee:update', async (configId: string, id: number, data: { name: string; address?: string; defaultLocation?: string }) => {
        const store = readStore()
        const list = store[configId] ?? []
        store[configId] = list.map(e => e.id === id ? { ...e, ...data } : e)
        writeStore(store)
        return true
    })

    handle('employee:delete', async (configId: string, id: number) => {
        const store = readStore()
        store[configId] = (store[configId] ?? []).filter(e => e.id !== id)
        writeStore(store)
        return true
    })
}
