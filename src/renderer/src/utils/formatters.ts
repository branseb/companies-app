export { fmtCurrency } from '@e-companies/shared'

export const fmtDate = (d: string): string => {
    if (!d) return '—'
    const [y, m, day] = d.slice(0, 10).split('-')
    return y && m && day ? `${parseInt(day)}. ${parseInt(m)}. ${y}` : d
}
