import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { handle } from './ipcHandle'
import type { CompanyRateConfig } from '@e-companies/shared'

type Store = Record<string, CompanyRateConfig>

const filePath = () => path.join(app.getPath('userData'), 'companyRates.json')

const readStore = (): Store => {
    try {
        const p = filePath()
        if (!fs.existsSync(p)) return {}
        return JSON.parse(fs.readFileSync(p, 'utf-8'))
    } catch { return {} }
}

const writeStore = (store: Store) =>
    fs.writeFileSync(filePath(), JSON.stringify(store, null, 2), 'utf-8')

export const readCompanyRates = (configId: string): CompanyRateConfig | null => {
    const store = readStore()
    return store[configId] ?? null
}

export const registerCompanyRatesIpc = () => {
    handle('companyRates:get', async (configId: string) => readCompanyRates(configId))

    handle('companyRates:save', async (configId: string, rates: CompanyRateConfig) => {
        const store = readStore()
        store[configId] = rates
        writeStore(store)
        return true
    })
}
