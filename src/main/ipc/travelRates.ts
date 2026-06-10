import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { handle } from './ipcHandle'

export const registerTravelRatesIpc = () => {
    handle('travelRates:get', async () => {
        const filePath = path.join(app.getPath('userData'), 'travelRates.json')
        if (!fs.existsSync(filePath)) return null
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    })

    handle('travelRates:save', async (rates: unknown) => {
        const filePath = path.join(app.getPath('userData'), 'travelRates.json')
        fs.writeFileSync(filePath, JSON.stringify(rates, null, 2), 'utf-8')
        return true
    })
}
