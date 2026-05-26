import { useCallback, useState } from "react";
import { useCompany } from "../context/company";
import type { CashEntry, CashRegister } from "../models/cashEntry";
import type { Tx } from "../models/bankTransaction";

export const useCashRegister = () => {
    const { activeCompany, activeConfigId } = useCompany();
    const [entries, setEntries] = useState<CashEntry[]>([]);
    const [registers, setRegisters] = useState<CashRegister[]>([]);
    const [bankTransactions, setBankTransactions] = useState<Tx[]>([]);

    const load = useCallback(async () => {
        if (!activeCompany?.id) return;
        setEntries(await window.api.cashEntry.byCompany(activeConfigId!, activeCompany.id));
    }, [activeCompany?.id, activeConfigId]);

    const loadRegisters = useCallback(async () => {
        if (!activeCompany?.id) return;
        setRegisters(await window.api.cashRegister.byCompany(activeConfigId!, activeCompany.id));
    }, [activeCompany?.id, activeConfigId]);

    const loadBankTransactions = useCallback(async () => {
        if (!activeCompany?.id) return;
        setBankTransactions(await window.api.bankTransaction.byCompany(activeConfigId!, activeCompany.id));
    }, [activeCompany?.id, activeConfigId]);

    return { entries, setEntries, registers, setRegisters, bankTransactions, setBankTransactions, load, loadRegisters, loadBankTransactions };
};
