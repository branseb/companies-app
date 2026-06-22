import { app, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { TravelOrder } from '../database/entities/travelOrder'
import { Company } from '../database/entities/company'
import { dbManager } from '../database/database-manager'
import { handle } from './ipcHandle'
import { logAction } from './auditLog'
import { generateTravelOrderPdf, resolveRates, DEFAULT_STRAVNE_RATES } from '@e-companies/shared'
import { adminDb, isPortalEnabled, setPortalEnabled } from '../firebase/admin'
import { migrateEmployeesToFirestore } from './employees'
import { readCompanyRates } from './companyRates'
import { readEmployeeRates } from './employeeRates'

const loadLegalRates = () => {
    try {
        const p = path.join(app.getPath('userData'), 'travelRates.json')
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'))
    } catch { /* ignore */ }
    return DEFAULT_STRAVNE_RATES
}

const buildRatesSnapshot = (configId: string, data: Partial<TravelOrder>) => {
    const travelDate = data.departureDate
    if (!travelDate) return {}
    const empRates = data.employeeId != null ? readEmployeeRates(configId, data.employeeId) : null
    const effective = resolveRates(
        travelDate,
        loadLegalRates(),
        readCompanyRates(configId),
        empRates,
        empRates?.isMobileWorker ?? false,
    )
    return {
        ratesSnapshot:          effective,
        kmRateUsed:             effective.kmRate,
        ratesAlgorithmVersion:  effective.algorithmVersion,
    }
}

// ── Firestore helpers ────────────────────────────────────────────────────────

const ordersCol = (configId: string) =>
    adminDb().collection('companies').doc(configId).collection('travelOrders')

const firestoreToOrder = (id: string, data: FirebaseFirestore.DocumentData): Partial<TravelOrder> => ({
    ...data,
    firebaseId: id,
    id: data.localId ?? (id as any),
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? new Date().toISOString(),
})

const orderToFirestore = (order: Partial<TravelOrder>, localId?: number) => {
    const { firebaseId: _f, company: _c, id: _i, ...rest } = order as any
    return { ...sanitize(rest), localId: localId ?? null }
}

const sanitize = (obj: unknown): unknown => {
    if (obj === undefined) return null
    if (obj === null || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return (obj as unknown[]).map(sanitize)
    return Object.fromEntries(
        Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sanitize(v)])
    )
}

// ── IPC registrácia ──────────────────────────────────────────────────────────

export const registerTravelOrdersIpc = () => {

    handle('travelOrder:byCompany', async (configId: string, companyId: number) => {
        if (isPortalEnabled(configId)) {
            const snap = await ordersCol(configId).orderBy('departureDate', 'desc').get()
            return snap.docs.map(d => firestoreToOrder(d.id, d.data()))
        }
        const db = await dbManager.getDB(configId)
        return db.getRepository(TravelOrder).find({
            where: { company: { id: companyId } },
            order: { departureDate: 'DESC', id: 'DESC' },
        })
    })

    handle('travelOrder:create', async (configId: string, companyId: number, data: Partial<TravelOrder>) => {
        if (isPortalEnabled(configId)) {
            const ref = await ordersCol(configId).add({
                ...orderToFirestore(data),
                createdAt: new Date().toISOString(),
            })
            return { ...data, firebaseId: ref.id, id: ref.id }
        }
        const db = await dbManager.getDB(configId)
        const company = await db.getRepository(Company).findOneBy({ id: companyId })
        if (!company) throw new Error('Firma nenájdená')
        const order = db.getRepository(TravelOrder).create({ ...data, ...buildRatesSnapshot(configId, data), createdAt: new Date().toISOString(), company })
        const saved = await db.getRepository(TravelOrder).save(order)
        await logAction(db, company.ico, 'create', 'travelOrder', saved.id, { employee: saved.employee, destination: saved.destination })
        return saved
    })

    handle('travelOrder:update', async (configId: string, id: number | string, data: Partial<TravelOrder>) => {
        if (isPortalEnabled(configId)) {
            const fbId = (data as any).firebaseId ?? String(id)
            await ordersCol(configId).doc(fbId).update(sanitize(orderToFirestore(data)) as any)
            return { success: true }
        }
        const db = await dbManager.getDB(configId)
        const { company: _c, ...rest } = data as any
        return db.getRepository(TravelOrder).update(id as number, { ...rest, ...buildRatesSnapshot(configId, data) })
    })

    handle('travelOrder:delete', async (configId: string, id: number | string) => {
        if (isPortalEnabled(configId)) {
            await ordersCol(configId).doc(String(id)).delete()
            return { success: true }
        }
        const db = await dbManager.getDB(configId)
        const result = await db.getRepository(TravelOrder).delete(id as number)
        await logAction(db, '', 'delete', 'travelOrder', id as number, {})
        return result
    })

    handle('travelOrder:generatePdf', async (configId: string, id: number | string, includeAccounting: boolean = true) => {
        let order: Partial<TravelOrder> & { company?: Company }

        if (isPortalEnabled(configId)) {
            const snap = await ordersCol(configId).doc(String(id)).get()
            if (!snap.exists) throw new Error('Cestovný príkaz nenájdený')
            order = firestoreToOrder(snap.id, snap.data()!) as any
            // načítame company zo SQLite pre údaje firmy na PDF
            const db = await dbManager.getDB(configId)
            const companies = await db.getRepository(Company).find()
            order.company = companies[0]
        } else {
            const db = await dbManager.getDB(configId)
            order = await db.getRepository(TravelOrder).findOneOrFail({
                where: { id: id as number },
                relations: ['company'],
            })
        }

        const company = order.company!
        const companyAddress = [
            company.address,
            company.zip && company.city ? `${company.zip} ${company.city}` : company.city,
        ].filter(Boolean).join(', ')

        const ratesHistory = (() => {
            try {
                const ratesPath = path.join(app.getPath('userData'), 'travelRates.json')
                if (fs.existsSync(ratesPath)) return JSON.parse(fs.readFileSync(ratesPath, 'utf-8'))
            } catch { /* ignore */ }
            return null
        })()

        const base64 = generateTravelOrderPdf({
            companyName:         company.name ?? '',
            companyAddress,
            employee:            order.employee!,
            employeeAddress:     order.employeeAddress,
            collaborators:       order.collaborators,
            destination:         order.destination!,
            purpose:             order.purpose,
            departureLocation:   order.departureLocation,
            departureDate:       order.departureDate!,
            departureTime:       order.departureTime,
            arrivalTime:         order.arrivalTime,
            returnDepartureTime: order.returnDepartureTime,
            returnLocation:      order.returnLocation,
            returnDate:          order.returnDate,
            returnTime:          order.returnTime,
            transportType:       order.transportType,
            ecv:                 order.ecv,
            distanceKm:          order.distanceKm,
            fuelConsumption:     order.fuelConsumption,
            fuelPricePerLiter:   order.fuelPricePerLiter,
            advanceAmount:       order.advanceAmount,
            advances:            order.advances as any,
            stravneAmount:       order.stravneAmount,
            stravneMultiplier:   order.stravneMultiplier,
            actualExpenses:      order.actualExpenses,
            currency:            order.currency!,
            freeRanajky:         order.freeRanajky,
            freeObed:            order.freeObed,
            freeVecera:          order.freeVecera,
            useExchangeRates:    order.useExchangeRates,
            exchangeRateDate:    order.exchangeRateDate,
            exchangeRates:       order.exchangeRates,
            trips:               order.trips as any,
            ratesHistory,
            includeAccounting,
            includeAdminFields:  order.includeAdminFields ?? true,
            applyAmortization:   order.applyAmortization ?? true,
            applyFuelCost:       order.applyFuelCost ?? true,
            isElectric:          order.isElectric ?? null,
        })

        const safeName = order.employee!.replace(/[/\\:*?"<>|]/g, '_')
        const filename = `cestovny_prikaz_${safeName}_${order.departureDate}.pdf`
        const filePath = path.join(app.getPath('downloads'), filename)
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
        shell.openPath(filePath)
        return filePath
    })

    // ── Portal nastavenia ──────────────────────────────────────────────────────

    handle('portal:isEnabled', async (configId: string) => isPortalEnabled(configId))

    handle('portal:setEnabled', async (configId: string, enabled: boolean) => {
        setPortalEnabled(configId, enabled)
        return { success: true }
    })

    handle('portal:syncRates', async (configId: string, rates: unknown) => {
        await adminDb().collection('companies').doc(configId)
            .collection('settings').doc('travelRates').set({ rates })
        return { success: true }
    })

    handle('portal:syncCompanyRates', async (configId: string, rates: unknown) => {
        await adminDb().collection('companies').doc(configId)
            .collection('settings').doc('companyRates').set(rates as object)
        return { success: true }
    })

    handle('portal:syncCompany', async (configId: string) => {
        const db = await dbManager.getDB(configId)
        const company = (await db.getRepository(Company).find())[0]
        if (!company) return { success: false }
        await adminDb().collection('companies').doc(configId).set({
            name:    company.name    ?? '',
            address: company.address ?? '',
            zip:     company.zip     ?? '',
            city:    company.city    ?? '',
            ico:     company.ico     ?? '',
        }, { merge: true })
        return { success: true }
    })

    handle('portal:migrate', async (configId: string, companyId: number) => {
        const db = await dbManager.getDB(configId)

        const company = (await db.getRepository(Company).find())[0]
        if (company) {
            await adminDb().collection('companies').doc(configId).set({
                name:    company.name    ?? '',
                address: company.address ?? '',
                zip:     company.zip     ?? '',
                city:    company.city    ?? '',
                ico:     company.ico     ?? '',
            }, { merge: true })
        }

        const orders = await db.getRepository(TravelOrder).find({
            where: { company: { id: companyId } },
        })

        let migrated = 0
        let skipped = 0

        for (const order of orders) {
            if (order.firebaseId) { skipped++; continue }

            const ref = await ordersCol(configId).add({
                ...orderToFirestore(order, order.id),
                createdAt: order.createdAt,
            })

            await db.getRepository(TravelOrder).update(order.id, { firebaseId: ref.id })
            migrated++
        }

        const migratedEmployees = await migrateEmployeesToFirestore(configId)

        return { migrated, skipped, total: orders.length, migratedEmployees }
    })
}
