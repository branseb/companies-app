import { fetchFuelPrice } from '@e-companies/shared'
import { handle } from './ipcHandle'

export const registerFuelPricesIpc = () => {
    handle('fuelPrices:fetch', async (fuelType: string, isoDate: string) => fetchFuelPrice(fuelType, isoDate))
}
