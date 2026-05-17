import { createContext, useContext, useEffect, useState } from "react";
import { Company } from "../models/company";
import { CompanyConfig } from "../models/companyConfig";

type CompanyContextType = {
    companyConfigs: CompanyConfig[];
    configsLoaded: boolean;
    activeCompany: Company | undefined;
    activeConfigId: string | undefined;
    selectConfig: (config: CompanyConfig) => Promise<Company>;
    clearActiveCompany: () => void;
    addCompanyConfig: (config: Omit<CompanyConfig, "id">) => Promise<CompanyConfig>;
    updateCompanyConfig: (config: CompanyConfig) => Promise<void>;
    deleteCompanyConfig: (id: string) => Promise<void>;
    updateCompany: (c: Company) => Promise<Company>;
    createCompany: (c: Company) => Promise<Company>;
};

const CompanyContext = createContext<CompanyContextType | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
    const [companyConfigs, setCompanyConfigs] = useState<CompanyConfig[]>([]);
    const [configsLoaded, setConfigsLoaded] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | undefined>();
    const [activeConfigId, setActiveConfigId] = useState<string | undefined>();

    useEffect(() => {
        window.api.db.list().then(configs => {
            setCompanyConfigs(configs);
            setConfigsLoaded(true);
        });
    }, []);

    const selectConfig = async (config: CompanyConfig): Promise<Company> => {
        const company = await window.api.db.connect(config);
        setActiveConfigId(config.id);
        setActiveCompany(company);
        return company;
    };

    const clearActiveCompany = () => {
        setActiveCompany(undefined);
        setActiveConfigId(undefined);
    };

    const addCompanyConfig = async (config: Omit<CompanyConfig, "id">): Promise<CompanyConfig> => {
        const saved = await window.api.db.add(config);
        setCompanyConfigs(prev => [...prev, saved]);
        return saved;
    };

    const updateCompanyConfig = async (config: CompanyConfig): Promise<void> => {
        const saved = await window.api.db.update(config);
        setCompanyConfigs(prev => prev.map(c => c.id === saved.id ? saved : c));
    };

    const deleteCompanyConfig = async (id: string): Promise<void> => {
        await window.api.db.delete(id);
        setCompanyConfigs(prev => prev.filter(c => c.id !== id));
        if (activeConfigId === id) clearActiveCompany();
    };

    const updateCompany = async (company: Company): Promise<Company> => {
        const saved = await window.api.company.update(activeConfigId!, company);
        setActiveCompany(saved);
        return saved;
    };

    const createCompany = async (company: Company): Promise<Company> => {
        const saved = await window.api.company.create(activeConfigId!, company);
        setActiveCompany(saved);
        return saved;
    };

    return (
        <CompanyContext.Provider value={{
            companyConfigs,
            configsLoaded,
            activeCompany,
            activeConfigId,
            selectConfig,
            clearActiveCompany,
            addCompanyConfig,
            updateCompanyConfig,
            deleteCompanyConfig,
            updateCompany,
            createCompany,
        }}>
            {children}
        </CompanyContext.Provider>
    );
}

export const useCompany = () => {
    const ctx = useContext(CompanyContext);
    if (!ctx) throw new Error("useCompany must be used inside Provider");
    return ctx;
};
