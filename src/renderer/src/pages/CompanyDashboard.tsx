import { Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCompany } from "../context/company";
import { InvoiceForm } from "../components/InvoiceForm";
import { InvoiceList } from "../components/InvoiceList";
import { BankTransactionList } from "../components/BankTransactionList";
import { CashRegisterList } from "../components/CashRegisterList";
import { CompanyHome } from "./CompanyHome";
import { EditCompanyPage } from "./EditCompanyPage";
import { AuditLogPage } from "./AuditLogPage";

export const CompanyDashboard = () => {
    const { configId } = useParams<{ configId: string }>();
    const { companyConfigs, configsLoaded, activeCompany, activeConfigId, selectConfig, clearActiveCompany } = useCompany();
    const navigate = useNavigate();
    const location = useLocation();
    const [refresh, setRefresh] = useState(false);
    const [connecting, setConnecting] = useState(false);

    // Ref so the effect doesn't re-run when activeConfigId changes (e.g. on clearActiveCompany).
    // The effect should only react to URL configId changes or config list loading.
    const activeConfigIdRef = useRef(activeConfigId);
    useEffect(() => { activeConfigIdRef.current = activeConfigId; });

    useEffect(() => {
        if (!configsLoaded || !configId) return;
        if (configId === activeConfigIdRef.current) return;

        const config = companyConfigs.find(c => c.id === configId);
        if (!config) {
            navigate("/", { replace: true });
            return;
        }

        let cancelled = false;
        setConnecting(true);
        selectConfig(config)
            .catch(() => { if (!cancelled) navigate("/", { replace: true }); })
            .finally(() => { if (!cancelled) setConnecting(false); });

        return () => { cancelled = true; };
    // activeConfigId intentionally NOT in deps — prevents race on clearActiveCompany + navigate("/")
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configId, configsLoaded, companyConfigs]);

    if (connecting || !configsLoaded) {
        return (
            <Stack height="100%" alignItems="center" justifyContent="center">
                <CircularProgress />
            </Stack>
        );
    }

    if (!activeCompany) return null;

    const base = `/${configId}`;
    const isHome = location.pathname === base || location.pathname === `${base}/`;

    return (
        <Stack height="100%" overflow="hidden">
            <Stack
                direction="row"
                alignItems="center"
                gap={1}
                px={2}
                py={1}
                sx={{ borderBottom: "1px solid", borderColor: "grey.200", flexShrink: 0 }}
            >
                {isHome ? (
                    <Button startIcon={<ArrowBack />} onClick={() => { clearActiveCompany(); navigate("/"); }} size="small" color="inherit">
                        Zmeniť firmu
                    </Button>
                ) : (
                    <Button startIcon={<ArrowBack />} onClick={() => navigate(base)} size="small" color="inherit">
                        Späť
                    </Button>
                )}
                <Typography variant="subtitle1" fontWeight={600} sx={{ ml: 1 }}>
                    {activeCompany.name}
                </Typography>
            </Stack>

            <Container sx={{ flex: 1, overflow: "auto", py: 4 }}>
                <Routes>
                    <Route index element={<CompanyHome />} />
                    <Route path="invoices/issued"   element={<InvoiceList refresh={refresh} type="issued"   />} />
                    <Route path="invoices/received" element={<InvoiceList refresh={refresh} type="received" />} />
                    <Route path="new-invoice" element={
                        <InvoiceForm onAdd={() => { setRefresh(r => !r); navigate(`${base}/invoices/issued`); }} />
                    } />
                    <Route path="bank" element={<BankTransactionList />} />
                    <Route path="cash" element={<CashRegisterList />} />
                    <Route path="edit" element={<EditCompanyPage onSaved={() => navigate(base)} />} />
                    <Route path="audit" element={<AuditLogPage />} />
                    <Route path="*" element={<Navigate to={base} replace />} />
                </Routes>
            </Container>
        </Stack>
    );
};
