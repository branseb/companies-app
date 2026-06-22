import { useEffect, useState } from 'react'
import { useCompany } from '../context/company'
import {
    TravelOrdersWidget,
    type TravelOrder,
    type TravelOrderInput,
    type StravneRates,
    type EmployeeRecord,
    type TravelPreferences,
    type CompanyRateConfig,
    type EmployeeFormData,
    DEFAULT_STRAVNE_RATES,
    DEFAULT_TRAVEL_PREFERENCES,
} from '@e-companies/shared'

export const TravelOrdersPage = ({ companyId: _companyId }: { companyId: string }) => {
    const { activeConfigId, activeCompany } = useCompany()
    const [orders, setOrders] = useState<TravelOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [rates, setRates] = useState<StravneRates>(DEFAULT_STRAVNE_RATES)
    const [companyRates, setCompanyRates] = useState<CompanyRateConfig | null>(null)
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

    useEffect(() => {
        if (!activeConfigId) return
        ;(window.api as any).companyRates.get(activeConfigId).then((r: CompanyRateConfig | null) => {
            setCompanyRates(r)
        })
    }, [activeConfigId])

    const loadEmployees = async () => {
        if (!activeConfigId) return
        const [list, empRates] = await Promise.all([
            (window.api as any).employee.byCompany(activeConfigId),
            (window.api as any).employeeRates.getAll(activeConfigId),
        ])
        const merged: EmployeeRecord[] = list.map((e: EmployeeRecord) => {
            const er = empRates[String(e.id)]
            return {
                ...e,
                rateKm:         er?.kmRate      ?? null,
                rateMeal5_12:   er?.meal5_12    ?? null,
                rateMeal12_18:  er?.meal12_18   ?? null,
                rateMeal18plus: er?.meal18plus  ?? null,
            }
        })
        setEmployees(merged)
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

    const handleCompanyRatesChange = async (r: CompanyRateConfig) => {
        if (!activeConfigId) return
        setCompanyRates(r)
        await (window.api as any).companyRates.save(activeConfigId, r)
        try { await (window.api as any).portal.syncCompanyRates(activeConfigId, r) } catch { /* portal nemusí byť povolený */ }
    }

    const saveEmpRates = async (configId: string, empId: number | string, data: EmployeeFormData) => {
        const rates = {
            kmRate:    data.rateKm         ?? null,
            meal5_12:  data.rateMeal5_12   ?? null,
            meal12_18: data.rateMeal12_18  ?? null,
            meal18plus: data.rateMeal18plus ?? null,
        }
        const hasAny = Object.values(rates).some(v => v != null)
        if (hasAny) {
            await (window.api as any).employeeRates.save(configId, empId, rates)
        } else {
            await (window.api as any).employeeRates.delete(configId, empId)
        }
    }

    const handleEmployeeCreate = async (data: EmployeeFormData) => {
        if (!activeConfigId) return
        const { rateKm: _k, rateMeal5_12: _m1, rateMeal12_18: _m2, rateMeal18plus: _m3, ...empData } = data
        const created = await (window.api as any).employee.create(activeConfigId, empData)
        if (created?.id) await saveEmpRates(activeConfigId, created.id, data)
        await loadEmployees()
    }

    const handleEmployeeUpdate = async (id: number, data: EmployeeFormData) => {
        if (!activeConfigId) return
        const { rateKm: _k, rateMeal5_12: _m1, rateMeal12_18: _m2, rateMeal18plus: _m3, ...empData } = data
        await (window.api as any).employee.update(activeConfigId, id, empData)
        await saveEmpRates(activeConfigId, id, data)
        await loadEmployees()
    }

    const handleEmployeeDelete = async (id: number) => {
        if (!activeConfigId) return
        await (window.api as any).employee.delete(activeConfigId, id)
        await (window.api as any).employeeRates.delete(activeConfigId, id)
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
            companyRates={companyRates}
            onCompanyRatesChange={handleCompanyRatesChange}
            employees={employees}
            onEmployeeCreate={handleEmployeeCreate}
            onEmployeeUpdate={handleEmployeeUpdate}
            onEmployeeDelete={handleEmployeeDelete}
            preferences={preferences}
            onPreferencesChange={handlePreferencesChange}
        />
    )
}
