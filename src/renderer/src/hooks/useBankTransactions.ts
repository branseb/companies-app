import { useCallback, useState } from "react";
import { useCompany } from "../context/company";
import type { BankAccount, Tx } from "../models/bankTransaction";

export const useBankTransactions = () => {
    const { activeCompany, activeConfigId } = useCompany();
    const [transactions, setTransactions] = useState<Tx[]>([]);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);

    const load = useCallback(async () => {
        if (!activeCompany?.id) return;
        setTransactions(await window.api.bankTransaction.byCompany(activeConfigId!, activeCompany.id));
    }, [activeCompany?.id, activeConfigId]);

    const loadAccounts = useCallback(async () => {
        if (!activeCompany?.id) return;
        setAccounts(await window.api.bankAccount.byCompany(activeConfigId!, activeCompany.id));
    }, [activeCompany?.id, activeConfigId]);

    return { transactions, setTransactions, accounts, load, loadAccounts };
};
