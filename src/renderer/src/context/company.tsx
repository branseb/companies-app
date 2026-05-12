import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Company } from "../models/company";

type CompanyContextType = {
    companies: Company[];
    activeCompany: Company | undefined;
    setActiveCompanyID: (id?: number) => void;
    clearActiveCompany: () => void;
    addCompany: (c: Company) => void;
    updateCompany: (c: Company) => Promise<void>;
};

const CompanyContext = createContext<CompanyContextType | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activeCompanyId, setActiveCompanyID] = useState<number | undefined>();
    const activeCompany = useMemo(() => companies.find(x => x.id === activeCompanyId), [companies, activeCompanyId])

    // 📥 LOAD zo súboru pri štarte
    useEffect(() => {
        const load = async () => {
            const data = await window.api.company.get();

            setCompanies(data);

            if (data.length > 0 && !activeCompany) {
                setActiveCompanyID(data[0].id);
            }
        };

        load();
    }, []);

    const addCompany = async (c: Company) => {
        const saved = await window.api.company.add(c);
        setCompanies((prev) => [...prev, saved]);
        setActiveCompanyID(saved.id);
    };

    const updateCompany = async (c: Company) => {
        const saved = await window.api.company.add(c);
        setCompanies((prev) => prev.map(x => x.id === saved.id ? saved : x));
    };

    return (
        <CompanyContext.Provider
            value={{
                companies,
                activeCompany,
                setActiveCompanyID,
                clearActiveCompany: () => setActiveCompanyID(undefined),
                addCompany,
                updateCompany,
            }}
        >
            {children}
        </CompanyContext.Provider>
    );
}

export const useCompany = () => {
    const ctx = useContext(CompanyContext);
    if (!ctx) throw new Error("useCompany must be used inside Provider");
    return ctx;
}