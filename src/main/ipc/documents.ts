import { app, dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { handle } from './ipcHandle'

const _require = createRequire(import.meta.url)
const pdfParse  = _require('pdf-parse') as (buf: Buffer, opts?: any) => Promise<{ text: string; numpages: number }>
const XMLParser = _require('fast-xml-parser').XMLParser as new (opts?: any) => { parse(xml: string): any }

export interface ParsedInvoiceData {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  deliveryDate?: string
  currency: string
  supplierName: string
  supplierIco: string
  supplierDic: string
  supplierIcDph: string
  supplierAddress?: string
  supplierZip?: string
  supplierCity?: string
  customerName: string
  customerIco: string
  customerDic: string
  customerAddress?: string
  customerZip?: string
  customerCity?: string
  totalAmount: number
  vatAmount: number
  taxRate: number
  parsedItems?: Array<{
    description: string
    quantity: number
    unit?: string
    unitPrice: number
    taxRate: number
  }>
}

function toIsoDate(raw: string): string {
  const p = raw.replace(/\s/g, '').split('.')
  if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
  return raw
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0
}

const COMPANY_SUFFIX = /s\.\s*r\.\s*o\.?|a\.\s*s\.?|k\.\s*s\.?|spol\.\s*s\s*r\.?\s*o\.?|š\.\s*p\.?|n\.\s*o\.?|o\.\s*z\.?|v\.\s*o\.\s*s\.?/i
const SKIP_LINE      = /^(?:dodávateľ|odberateľ|fakturač|faktúr|kontakt|ičo|dič|ič\s*dph|email|tel|fax|iban|web|www|mobil|spôsob|forma\s+ú|miesto|číslo\s+účtu)/i
const DATE_RE        = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/g

function parseSlovakInvoice(text: string): ParsedInvoiceData {
  const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const norm  = lines.join('\n')

  // Helper: find a regex match at line i, then backwards, then forwards.
  // Returns first capture group or full match.
  function findNear(i: number, pat: RegExp, back = 5, fwd = 2): string {
    const m0 = lines[i].match(pat)
    if (m0) return (m0[1] ?? m0[0]).trim()
    for (let j = i - 1; j >= Math.max(0, i - back); j--) {
      const m = lines[j].match(pat); if (m) return (m[1] ?? m[0]).trim()
    }
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + fwd); j++) {
      const m = lines[j].match(pat); if (m) return (m[1] ?? m[0]).trim()
    }
    return ''
  }

  // --- IČO / DIČ / IČ DPH ---
  // Handles both "IČO: value" (standard) and "value\nIČO:" (reversed, e.g. CODERAMA format).
  // Section headers ODBERATEĽ/DODÁVATEĽ determine customer vs supplier assignment.
  const ids: Record<string, string> = {
    supplierIco: '', supplierDic: '', supplierIcDph: '',
    customerIco: '', customerDic: '', customerIcDph: '',
  }
  let section: 'supplier' | 'customer' | null = null

  function assignId(field: string, val: string) {
    const sk = `supplier${field}`, ck = `customer${field}`
    if (section === 'supplier') { if (!ids[sk]) ids[sk] = val }
    else if (section === 'customer') { if (!ids[ck]) ids[ck] = val }
    else { if (!ids[sk]) ids[sk] = val; else if (!ids[ck]) ids[ck] = val }
  }

  lines.forEach((l, i) => {
    if (/^dodávateľ/i.test(l)) { section = 'supplier'; return }
    if (/^odberateľ/i.test(l)) { section = 'customer'; return }

    if (/IČO\s*:/i.test(l)) {
      const v = l.match(/IČO\s*:?\s*(\d{6,8})/i)?.[1] ?? findNear(i, /^(\d{6,8})\s*$/)
      if (v) assignId('Ico', v)
    }
    if (/DIČ\s*:/i.test(l) && !/IČ\s*DPH/i.test(l)) {
      const v = l.match(/DIČ\s*:?\s*(SK\d+|\d{8,12})/i)?.[1] ?? findNear(i, /^(\d{8,12})\s*$/)
      if (v) assignId('Dic', v)
    }
    if (/IČ\s*DPH\s*:/i.test(l)) {
      const v = l.match(/IČ\s*DPH\s*:?\s*(SK\d+)/i)?.[1] ?? findNear(i, /(SK\d+)/)
      if (v) assignId('IcDph', v)
    }
  })

  const supplierIco   = ids.supplierIco
  const supplierDic   = ids.supplierDic
  const supplierIcDph = ids.supplierIcDph
  const customerIco   = ids.customerIco
  const customerDic   = ids.customerDic

  // --- Section boundaries for address extraction ---
  const odberatelIdx = lines.findIndex(l => /^odberateľ/i.test(l))
  const dodavatelIdx = lines.findIndex(l => /^dodávateľ/i.test(l))
  const custEnd = (odberatelIdx >= 0 && dodavatelIdx >= 0 && odberatelIdx < dodavatelIdx) ? dodavatelIdx : lines.length
  const suppEnd = (dodavatelIdx >= 0 && odberatelIdx >= 0 && dodavatelIdx < odberatelIdx) ? odberatelIdx : lines.length

  function addressInSection(start: number, end: number) {
    let address = '', zip = '', city = ''
    let skippedName = false
    for (let i = start + 1; i < Math.min(end, start + 15); i++) {
      const l = lines[i]
      if (!skippedName) { if (l.length >= 2) skippedName = true; continue }
      if (/^(IČO|DIČ|IČ\s*DPH|IBAN|SWIFT|tel|fax|email|web|mob|zapísaná)/i.test(l)) break
      if (/^\d{6,}/.test(l) || /^SK[A-Z0-9]{8,}/.test(l)) break
      if (/^(slovensko|česko|maďarsko|rakúsko|ukraine|czech|hungary|austria)/i.test(l)) break
      const zipCity = l.match(/^(\d{3})\s?(\d{2})\s+(.+)$/)
      if (zipCity) { zip = zipCity[1] + zipCity[2]; city = zipCity[3]; continue }
      const zipOnly = l.match(/^(\d{3})\s?(\d{2})\s*$/)
      if (zipOnly) { zip = zipOnly[1] + zipOnly[2]; continue }
      if (!address && /\d/.test(l) && /[a-záéíóúýčšžďťňôäě]/i.test(l)) { address = l; continue }
    }
    return { address, zip, city }
  }

  const custAddr = odberatelIdx >= 0 ? addressInSection(odberatelIdx, custEnd) : { address: '', zip: '', city: '' }
  const suppAddr = dodavatelIdx >= 0 ? addressInSection(dodavatelIdx, suppEnd) : { address: '', zip: '', city: '' }

  // --- Dates ---
  function labeledDate(pat: RegExp): string | undefined {
    const m = norm.match(pat)
    return m ? toIsoDate(m[1]) : undefined
  }
  const issueDate    = labeledDate(/(?:dátum\s+(?:vystavenia|vyhotovenia|vystavenia\s+faktúry)|vystavená?\s+(?:dňa?|:))\s*:?\s*(\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{4})/i)
  const dueDate      = labeledDate(/(?:dátum\s+splatnosti|splatnosť|splatná?\s+do|dátum\s+úhrady)\s*:?\s*(\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{4})/i)
  const deliveryDate = labeledDate(/(?:dátum\s+(?:dodania|plnenia|zdaniteľného\s+plnenia|dodávky))\s*:?\s*(\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{4})/i)

  const allDates = [...norm.matchAll(DATE_RE)]
    .map(m => toIsoDate(`${m[1]}.${m[2]}.${m[3]}`))
    .filter(d => { const y = parseInt(d); return y >= 2020 && y <= 2035 })
    .sort()
  const finalIssueDate = issueDate ?? allDates[0] ?? ''
  const finalDueDate   = dueDate   ?? allDates.find(d => d > (finalIssueDate || '0')) ?? allDates[1] ?? ''

  // --- Invoice number ---
  const invPatterns = [
    /(?:číslo\s+faktúry|faktúra\s+číslo)\s*:?\s*([A-Z0-9][\w\-\/]{0,20})/i,
    /faktúra\s+(?:č\.?|číslo)\s*:?\s*([A-Z0-9][\w\-\/]{0,20})/i,
    /(?:č\.?\s*faktúry|invoice\s*(?:no\.?|number|#))\s*:?\s*([A-Z0-9][\w\-\/]{0,20})/i,
    /(?:číslo\s+dokladu|doklad\s+č\.?)\s*:?\s*([A-Z0-9][\w\-\/]{0,20})/i,
    /^faktúra\s+([A-Z0-9][\w\-\/]{1,20})$/im,
  ]
  let invoiceNumber = ''
  for (const pat of invPatterns) {
    const m = norm.match(pat)
    if (m?.[1] && !/^(č|číslo|number|no)$/i.test(m[1])) {
      invoiceNumber = m[1].replace(/[^a-zA-Z0-9\-\/]/g, '')
      break
    }
  }
  if (!invoiceNumber) {
    const numLine = lines.find(l => /^\d{6,}$/.test(l))
    if (numLine) invoiceNumber = numLine
  }

  // --- Amounts ---
  let totalAmount = 0
  for (const pat of [
    /(?:spolu\s+(?:s\s+)?(?:dph|daňou)|celková\s+suma|suma\s+(?:celkom|na\s+úhradu)|k\s+úhrade|celkom\s+(?:s\s+)?(?:dph|daňou)|na\s+úhradu)\s*:?\s*([\d\s]+[,.]\d{2})/i,
    /(?:spolu|celkom)\s*:?\s*([\d\s]+[,.]\d{2})\s*(?:€|EUR)/i,
    /(?:total|amount\s+due)\s*:?\s*([\d\s]+[,.]\d{2})/i,
  ]) {
    const m = norm.match(pat)
    if (m?.[1]) { totalAmount = parseAmount(m[1]); if (totalAmount > 0) break }
  }

  let vatAmount = 0
  for (const pat of [
    /(?:DPH|daň)\s+(?:20|23|10|5)\s*%\s*:?\s*([\d\s]+[,.]\d{2})/i,
    /(?:DPH\s+celkom|suma\s+dph|výška\s+dph|daň\s+celkom)\s*:?\s*([\d\s]+[,.]\d{2})/i,
    /(?:VAT|tax)\s+(?:amount|total)\s*:?\s*([\d\s]+[,.]\d{2})/i,
    /^DPH\s*:?\s*([\d\s]+[,.]\d{2})/im,
  ]) {
    const m = norm.match(pat)
    if (m?.[1]) { vatAmount = parseAmount(m[1]); if (vatAmount > 0) break }
  }

  const isNonVatPayer = /nie\s+som\s+platca\s+DPH|neobsahuje\s+DPH|neplátca\s+DPH/i.test(norm)
  const taxRateMatch  = norm.match(/\b(23|20|10|5)\s*%/)
  const taxRate = isNonVatPayer ? 0 : (taxRateMatch ? parseInt(taxRateMatch[1]) : 20)

  // Backward lookup for total: "210,00\n...\nCelková suma s DPH" (OMEGA format)
  if (totalAmount === 0) {
    const lblIdx = lines.findIndex(l => /celková\s+(?:fakturovaná\s+)?suma|celková\s+cena\s+s/i.test(l))
    if (lblIdx > 0) {
      for (let i = lblIdx - 1; i >= Math.max(0, lblIdx - 6); i--) {
        const m = lines[i].match(/^([\d ]+[,.]\d{2})\s*$/)
        if (m) { totalAmount = parseAmount(m[1]); break }
      }
    }
  }

  // --- Item lines (description | qty | unit | tax% | unitPrice€ concatenated) ---
  function parseItemLines() {
    const headerIdx = lines.findIndex(l => /popis.*(počet|cena|množstvo|jedn)/i.test(l))
    if (headerIdx === -1) return []
    const result: Array<{ description: string; quantity: number; unit?: string; unitPrice: number; taxRate: number }> = []
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const l = lines[i]
      if (/^(súhrn|spolu|celkom|základ|zaokrúh|predom|k\s+úhrade|podpis|sadzba)/i.test(l)) break
      const m = l.match(/^(.+?)([\d ]+[,.]\d+)\s*([a-záéíóúýčšžďťňôäě²³\/]{1,8})\s*(\d+)\s*%\s*([\d ]+[,.]\d{2})\s*€/i)
      if (m?.[1]?.trim()) {
        result.push({ description: m[1].trim(), quantity: parseAmount(m[2]), unit: m[3], taxRate: parseInt(m[4]), unitPrice: parseAmount(m[5]) })
      }
    }
    return result
  }
  const parsedItems = parseItemLines()

  // --- Company names (line-based) ---
  function nameNearLabel(labelPat: RegExp): string {
    const idx = lines.findIndex(l => labelPat.test(l))
    if (idx === -1) return ''
    const inlineM = lines[idx].match(/:\s*(.{4,})$/)
    if (inlineM) return inlineM[1].trim()
    for (let i = idx + 1; i <= Math.min(lines.length - 1, idx + 6); i++) {
      const l = lines[i]
      if (SKIP_LINE.test(l)) break
      if (l.length < 3) continue
      if (COMPANY_SUFFIX.test(l)) return l
      // Skip lines that are clearly form labels (contain colon) or start with digits/country codes
      if (!/:/.test(l) && !/^\d/.test(l) && !/^[A-Z]{2}\d/.test(l)) return l
    }
    return ''
  }

  function nameNearIco(ico: string): string {
    if (!ico) return ''
    const idx = lines.findIndex(l => new RegExp(`IČO\\s*:?\\s*${ico}`, 'i').test(l))
    if (idx === -1) return ''
    // Look back up to 20 lines for a company suffix — covers layouts where name is far from IČO
    for (let i = idx - 1; i >= Math.max(0, idx - 20); i--) {
      if (COMPANY_SUFFIX.test(lines[i])) return lines[i]
    }
    return ''
  }

  const supplierName = nameNearLabel(/^dodávateľ/i) || nameNearIco(supplierIco)
  const customerName = nameNearLabel(/^odberateľ/i)  || nameNearIco(customerIco)

  return {
    invoiceNumber,
    issueDate: finalIssueDate,
    dueDate: finalDueDate,
    deliveryDate,
    currency: 'EUR',
    supplierName,
    supplierIco,
    supplierDic,
    supplierIcDph,
    supplierAddress: suppAddr.address || undefined,
    supplierZip:     suppAddr.zip     || undefined,
    supplierCity:    suppAddr.city    || undefined,
    customerName,
    customerIco,
    customerDic,
    customerAddress: custAddr.address || undefined,
    customerZip:     custAddr.zip     || undefined,
    customerCity:    custAddr.city    || undefined,
    totalAmount,
    vatAmount,
    taxRate,
    parsedItems: parsedItems.length ? parsedItems : undefined,
  }
}

// ─── ISDOC XML parsing ────────────────────────────────────────────────────────

function extractIsdocXml(buffer: Buffer): string | null {
  // ISDOC XML is often embedded uncompressed in the PDF binary stream
  const raw = buffer.toString('latin1')
  const start = raw.indexOf('<?xml')
  if (start < 0) return null
  for (const endTag of ['</Invoice>', '</isdoc:Invoice>', '</inv:Invoice>']) {
    const end = raw.indexOf(endTag, start)
    if (end < 0) continue
    const xml = raw.slice(start, end + endTag.length)
    if (/AccountingSupplierParty|SupplierParty|InvoiceLine/i.test(xml)) return xml
  }
  return null
}

function parseIsdocXml(xml: string): ParsedInvoiceData {
  // Strip namespace prefixes so we can access tags uniformly
  const cleaned = xml.replace(/<(\/?)[a-zA-Z][a-zA-Z0-9]*:/g, '<$1')
  const parser  = new XMLParser({ parseTagValue: false, ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: true })
  const doc     = parser.parse(cleaned)
  const inv     = doc.Invoice ?? {}

  function arr<T>(v: T | T[] | undefined | null): T[] {
    return !v ? [] : Array.isArray(v) ? v : [v]
  }
  function s(v: unknown): string {
    if (v === null || v === undefined) return ''
    if (typeof v === 'object') return String((v as any)['#text'] ?? '').trim()
    return String(v).trim()
  }
  function n(v: unknown): number { return parseFloat(s(v).replace(',', '.')) || 0 }

  function parseParty(party: any) {
    const ico  = s(arr(party?.PartyIdentification)[0]?.ID)
    const taxSchemes = arr(party?.PartyTaxScheme)
    const taxId = s(taxSchemes[0]?.CompanyID)
    const icDph = taxId.startsWith('SK') ? taxId : ''
    const dic   = icDph ? icDph.slice(2) : taxId
    const addr  = party?.PostalAddress ?? {}
    return {
      name:    s(party?.PartyName?.Name),
      ico, dic, icDph,
      address: s(addr.StreetName)  || undefined,
      zip:     s(addr.PostalZone)  || undefined,
      city:    s(addr.CityName)    || undefined,
    }
  }

  const supplier = parseParty(inv.AccountingSupplierParty?.Party)
  const customer = parseParty(inv.AccountingCustomerParty?.Party)

  const parsedItems = arr(inv.InvoiceLine).map(line => ({
    description: s(line.Item?.Description || line.Item?.Name),
    quantity:    n(line.InvoicedQuantity),
    unit:        s(line.InvoicedQuantity?.['@_unitCode']) || undefined,
    unitPrice:   n(line.Price?.PriceAmount),
    taxRate:     n(line.ClassifiedTaxCategory?.Percent ?? 0),
  })).filter(it => it.description)

  const totals    = inv.LegalMonetaryTotal ?? {}
  const totalAmount = n(totals.TaxInclusiveAmount ?? totals.PayableAmount)
  const vatAmount   = n(inv.TaxTotal?.TaxAmount)
  const taxRate     = n(arr(inv.TaxTotal?.TaxSubtotal)[0]?.TaxCategory?.Percent ?? 20)

  return {
    invoiceNumber:   s(inv.ID),
    issueDate:       s(inv.IssueDate),
    dueDate:         s(inv.DueDate),
    deliveryDate:    s(inv.TaxPointDate || inv.DeliveryDate) || undefined,
    currency:        s(inv.DocumentCurrencyCode) || 'EUR',
    supplierName:    supplier.name,    supplierIco:     supplier.ico,
    supplierDic:     supplier.dic,     supplierIcDph:   supplier.icDph,
    supplierAddress: supplier.address, supplierZip:     supplier.zip,    supplierCity:    supplier.city,
    customerName:    customer.name,    customerIco:     customer.ico,
    customerDic:     customer.dic,
    customerAddress: customer.address, customerZip:     customer.zip,    customerCity:    customer.city,
    totalAmount, vatAmount, taxRate,
    parsedItems: parsedItems.length ? parsedItems : undefined,
  }
}

// ──────────────────────────────────────────────────────────────────────────────

const TYPE_FOLDERS: Record<string, string> = {
  invoice:          'Faktúry',
  invoice_issued:   'Vydané faktúry',
  invoice_received: 'Prijaté faktúry',
  bank_statement:   'Výpisy z účtu',
  travel:           'Cestovné',
  receipt:          'Bloky',
  other:            'Ostatné',
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

  handle('document:readFile', async (filePath: string): Promise<string> => {
    const buffer = fs.readFileSync(filePath)
    return buffer.toString('base64')
  })

  handle('document:parseInvoice', async (base64: string): Promise<ParsedInvoiceData & { _rawText?: string; _source?: 'isdoc' | 'regex' }> => {
    const buffer   = Buffer.from(base64, 'base64')
    const isdocXml = extractIsdocXml(buffer)
    if (isdocXml) return { ...parseIsdocXml(isdocXml), _rawText: isdocXml, _source: 'isdoc' as const }
    const pdf = await pdfParse(buffer)
    return { ...parseSlovakInvoice(pdf.text), _rawText: pdf.text, _source: 'regex' as const }
  })

}
