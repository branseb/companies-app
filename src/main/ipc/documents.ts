import { app, dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { handle } from './ipcHandle'

const TYPE_FOLDERS: Record<string, string> = {
  invoice:        'Faktúry',
  bank_statement: 'Výpisy z účtu',
  travel:         'Cestovné',
  other:          'Ostatné',
}

const settingsPath = () => path.join(app.getPath('userData'), 'app-settings.json')

function readSettings(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')) } catch { return {} }
}

function writeSettings(data: Record<string, string>) {
  fs.writeFileSync(settingsPath(), JSON.stringify(data, null, 2), 'utf-8')
}

export const registerDocumentsIpc = () => {
  handle('document:getFolder', async () => {
    return readSettings().downloadFolder ?? app.getPath('downloads')
  })

  handle('document:setFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    const folder = result.filePaths[0]
    writeSettings({ ...readSettings(), downloadFolder: folder })
    return folder
  })

  handle('document:save', async (fileName: string, base64: string, docType: string, companyName: string) => {
    const root        = readSettings().downloadFolder ?? app.getPath('downloads')
    const safeCompany = companyName.replace(/[/\\:*?"<>|]/g, '_')
    const subfolder   = TYPE_FOLDERS[docType] ?? 'Ostatné'
    const folder      = path.join(root, safeCompany, subfolder)
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
    const filePath    = path.join(folder, fileName)
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
    return filePath
  })

  handle('document:openCompanyFolder', async (companyName: string) => {
    const root        = readSettings().downloadFolder ?? app.getPath('downloads')
    const safeCompany = companyName.replace(/[/\\:*?"<>|]/g, '_')
    const folder      = path.join(root, safeCompany)
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
    shell.openPath(folder)
  })
}
