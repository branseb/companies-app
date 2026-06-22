import { useCallback, useEffect, useRef, useState } from "react";
import { useCompany } from "../context/company";
import { useSnackbar } from "./useSnackbar";
import { parseInvoiceXML } from "../utils/parseInvoiceXML";
import type { EN16931Invoice } from "../models/EN16931Invoice";
import type { InvoiceRow } from "../components/invoice/invoiceTypes";
import { today } from "@e-companies/shared";

export const useInvoiceList = (type: "issued" | "received", refresh: boolean, onAdd?: () => void) => {
    const { activeCompany, activeConfigId } = useCompany();
    const { snackbar, showSnackbar, closeSnackbar } = useSnackbar();

    const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

    const [xmlInvoice, setXmlInvoice] = useState<EN16931Invoice | null>(null);
    const [xmlFormat, setXmlFormat] = useState("");
    const [xmlDialog, setXmlDialog] = useState(false);

    const loadInvoices = useCallback(() => {
        if (!activeCompany) return;
        setLoading(true);
        const fetch = type === "issued"
            ? window.api.invoice.byCompany(activeConfigId!, activeCompany.id!)
            : window.api.invoice.byCustomer(activeConfigId!, activeCompany.id!);
        fetch.then((data: any[]) => setInvoices(data.map(i => ({ ...i, id: String(i.id) })))).finally(() => setLoading(false));
    }, [type, activeCompany, activeConfigId]);

    useEffect(() => { loadInvoices(); }, [loadInvoices, refresh]);

    useEffect(() => {
        if (!highlightId) return;
        const t = setTimeout(() => {
            highlightRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return () => clearTimeout(t);
    }, [highlightId, invoices]);

    const handleDownload = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPdfLoading(id);
        try {
            const filePath = await window.electron.pdf.download(activeConfigId!, id);
            window.electron.pdf.open(filePath);
        } catch {
            showSnackbar("Chyba pri generovaní PDF", "error");
        } finally {
            setPdfLoading(null);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await window.api.invoice.delete(activeConfigId!, Number(id));
        setInvoices(prev => prev.filter(i => i.id !== id));
    };

    const handleTogglePaid = async (inv: InvoiceRow, e: React.MouseEvent) => {
        e.stopPropagation();
        const newPaid = !inv.paid;
        const newPaidDate = newPaid ? today() : undefined;
        await window.api.invoice.markPaid(activeConfigId!, Number(inv.id), newPaid);
        setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, paid: newPaid, paidDate: newPaidDate } : i));
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const text = ev.target?.result as string;
            const result = parseInvoiceXML(text);
            if ("error" in result) showSnackbar(result.error, "error");
            else { setXmlInvoice(result.invoice); setXmlFormat(result.format); setXmlDialog(true); }
        };
        reader.readAsText(file, "utf-8");
        e.target.value = "";
    };

    const handleImport = async (invoice: EN16931Invoice) => {
        try {
            await window.api.invoice.create(activeConfigId!, invoice);
            setXmlDialog(false);
            onAdd?.();
            loadInvoices();
            showSnackbar("Faktúra importovaná");
        } catch {
            showSnackbar("Chyba pri importe faktúry", "error");
        }
    };

    const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

    return {
        invoices, setInvoices, loading, pdfLoading,
        expandedId, setExpandedId, highlightId, setHighlightId, highlightRowRef,
        xmlInvoice, xmlFormat, xmlDialog, setXmlDialog,
        snackbar, closeSnackbar,
        loadInvoices, handleDownload, handleDelete, handleTogglePaid,
        handleFile, handleImport, toggle,
    };
};
