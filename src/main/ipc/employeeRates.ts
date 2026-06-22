import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { handle } from './ipcHandle'
import type { EmployeeRateConfig } from '@e-companies/shared'

type Store = Record<string, Record<string, EmployeeRateConfig>>

const filePath = () => path.join(app.getPath('userData'), 'employeeRates.json')

const readStore = (): Store => {
    try {
        const p = filePath()
        if (!fs.existsSync(p)) return {}
        return JSON.parse(fs.readFileSync(p, 'utf-8'))
    } catch { return {} }
}

const writeStore = (store: Store) =>
    fs.writeFileSync(filePath(), JSON.stringify(store, null, 2), 'utf-8')

export const readEmployeeRates = (configId: string, employeeId: number | string): EmployeeRateConfig | null => {
    const store = readStore()
    return store[configId]?.[String(employeeId)] ?? null
}

export const registerEmployeeRatesIpc = () => {
    handle('employeeRates:get', async (configId: string, employeeId: number | string) =>
        readEmployeeRates(configId, employeeId)
    )

    handle('employeeRates:getAll', async (configId: string) => {
        const store = readStore()
        return store[configId] ?? {}
    })

    handle('employeeRates:save', async (configId: string, employeeId: number | string, rates: EmployeeRateConfig) => {
        const store = readStore()
        if (!store[configId]) store[configId] = {}
        store[configId][String(employeeId)] = rates
        writeStore(store)
        return true
    })

    handle('employeeRates:delete', async (configId: string, employeeId: number | string) => {
        const store = readStore()
        if (store[configId]) {
            delete store[configId][String(employeeId)]
            writeStore(store)
        }
        return true
    })
}
