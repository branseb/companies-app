import { fetchExchangeRates } from '@e-companies/shared'
import { handle } from './ipcHandle'

export const registerExchangeRatesIpc = () => {
    handle('exchangeRates:fetch', async (isoDate: string) => fetchExchangeRates(isoDate))
}
