import { useEffect, useState } from 'react'
import { useCompany } from '../context/company'
import {
    TravelOrdersWidget,
    type TravelOrder,
    type TravelOrderInput,
    type StravneRates,
    type EmployeeRecord,
    type TravelPreferences,
    DEFAULT_STRAVNE_RATES,
    DEFAULT_TRAVEL_PREFERENCES,
} from '@e-companies/shared'

export const TravelOrdersPage = ({ companyId: _companyId }: { companyId: string }) => {
    const { activeConfigId, activeCompany } = useCompany()
    const [orders, setOrders] = useState<TravelOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [rates, setRates] = useState<StravneRates>(DEFAULT_STRAVNE_RATES)
    const [employees, setEmployees] = useState<EmployeeRecord[]>([])
    const [preferences, setPreferences] = useState<TravelPreferences>(DEFAULT_TRAVEL_PREFERENCES)

    const load = async () => {
        if (!activeConfigId || !activeCompany?.id) return
        setLoading(true)
        try {
            const rows = await (window.api as any).travelOrder.byCompany(activeConfigId, activeCompany.id)
            setOrders(rows)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [activeConfigId, activeCompany?.id])

    useEffect(() => {
        ;(window.api as any).travelRates.get().then((r: StravneRates | null) => {
            if (r) setRates(r)
        })
        ;(window.api as any).travelPreferences.get().then((p: TravelPreferences | null) => {
            if (p) setPreferences(p)
        })
    }, [])

    const loadEmployees = async () => {
        if (!activeConfigId) return
        const list = await (window.api as any).employee.byCompany(activeConfigId)
        setEmployees(list)
    }

    useEffect(() => { loadEmployees() }, [activeConfigId])

    const handleAdd = async (data: TravelOrderInput) => {
        if (!activeConfigId || !activeCompany?.id) return
        await (window.api as any).travelOrder.create(activeConfigId, activeCompany.id, data)
        await load()
    }

    const handleUpdate = async (id: TravelOrder['id'], data: Partial<TravelOrderInput>) => {
        if (!activeConfigId) return
        await (window.api as any).travelOrder.update(activeConfigId, id, data)
        await load()
    }

    const handleDelete = async (id: TravelOrder['id']) => {
        if (!activeConfigId) return
        await (window.api as any).travelOrder.delete(activeConfigId, id)
        setOrders(o => o.filter(x => x.id !== id))
    }

    const handleGeneratePdf = async (order: TravelOrder) => {
        if (!activeConfigId) return
        await (window.api as any).travelOrder.generatePdf(activeConfigId, order.id, order.includeAccounting ?? true)
    }

    const handlePreferencesChange = async (p: TravelPreferences) => {
        setPreferences(p)
        await (window.api as any).travelPreferences.save(p)
    }

    const handleRatesChange = async (r: StravneRates) => {
        setRates(r)
        await (window.api as any).travelRates.save(r)
        if (activeConfigId) {
            try { await (window.api as any).portal.syncRates(activeConfigId, r) } catch { /* portal nemusí byť povolený */ }
        }
    }

    const handleEmployeeCreate = async (data: { name: string; address?: string }) => {
        if (!activeConfigId) return
        await (window.api as any).employee.create(activeConfigId, data)
        await loadEmployees()
    }

    const handleEmployeeUpdate = async (id: number, data: { name: string; address?: string }) => {
        if (!activeConfigId) return
        await (window.api as any).employee.update(activeConfigId, id, data)
        await loadEmployees()
    }

    const handleEmployeeDelete = async (id: number) => {
        if (!activeConfigId) return
        await (window.api as any).employee.delete(activeConfigId, id)
        await loadEmployees()
    }

    return (
        <TravelOrdersWidget
            orders={orders}
            loading={loading}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onGeneratePdf={handleGeneratePdf}
            ratesHistory={rates}
            onRatesChange={handleRatesChange}
            employees={employees}
            onEmployeeCreate={handleEmployeeCreate}
            onEmployeeUpdate={handleEmployeeUpdate}
            onEmployeeDelete={handleEmployeeDelete}
            preferences={preferences}
            onPreferencesChange={handlePreferencesChange}
        />
    )
}
