import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { handle } from './ipcHandle'
import { dbManager } from '../database/database-manager'
import { Receipt } from '../database/entities/receipt'
import { Company } from '../database/entities/company'

function readSettings(): Record<string, string> {
    const p = path.join(app.getPath('userData'), 'app-settings.json')
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return {} }
}

export const registerReceiptsIpc = () => {

    handle('receipt:create', async (
        configId: string,
        companyId: number,
        ekasaId: string,
        ekasaDataJson: string,
        photoBase64?: string,
        photoFileName?: string,
        notes?: string,
    ) => {
        const ds      = await dbManager.getDB(configId)
        const repo    = ds.getRepository(Receipt)
        const company = await ds.getRepository(Company).findOneByOrFail({ id: companyId })

        if (ekasaId) {
            const existing = await repo.findOne({ where: { ekasaId, company: { id: companyId } } })
            if (existing) return { ...existing, duplicate: true }
        }

        let photoPath: string | undefined
        if (photoBase64 && photoFileName) {
            const root        = readSettings().downloadFolder ?? app.getPath('downloads')
            const safeCompany = company.name.replace(/[/\\:*?"<>|]/g, '_')
            const folder      = path.join(root, safeCompany, 'Bloky')
            if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
            photoPath = path.join(folder, photoFileName)
            fs.writeFileSync(photoPath, Buffer.from(photoBase64, 'base64'))
        }

        const receipt = repo.create({
            ekasaId,
            ekasaDataJson,
            photoPath,
            notes,
            createdAt: new Date().toISOString(),
            company,
        })
        return repo.save(receipt)
    })

    handle('receipt:byCompany', async (configId: string, companyId: number) => {
        const ds   = await dbManager.getDB(configId)
        const rows = await ds.getRepository(Receipt).find({
            where: { company: { id: companyId } },
            order: { createdAt: 'DESC' },
        })
        return rows.map(r => ({
            id:         r.id,
            ekasaId:    r.ekasaId,
            ekasaData:  r.ekasaDataJson ? JSON.parse(r.ekasaDataJson) : null,
            photoPath:  r.photoPath,
            notes:      r.notes,
            createdAt:  r.createdAt,
        }))
    })

    handle('receipt:delete', async (configId: string, id: number) => {
        const ds     = await dbManager.getDB(configId)
        const repo   = ds.getRepository(Receipt)
        const record = await repo.findOneBy({ id })
        if (record?.photoPath && fs.existsSync(record.photoPath)) {
            fs.unlinkSync(record.photoPath)
        }
        await repo.delete(id)
    })

    handle('receipt:loadPhoto', async (_configId: string, photoPath: string): Promise<string | null> => {
        if (!photoPath || !fs.existsSync(photoPath)) return null
        return fs.readFileSync(photoPath).toString('base64')
    })
}
