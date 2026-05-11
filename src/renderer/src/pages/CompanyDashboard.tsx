import { Button, Container, Stack, Typography } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCompany } from "../context/company";
import { InvoiceForm } from "../components/InvoiceForm";
import { InvoiceList } from "../components/InvoiceList";
import { CompanyHome } from "./CompanyHome";
import { EditCompanyPage } from "./EditCompanyPage";

export const CompanyDashboard = () => {
    const { companyId } = useParams<{ companyId: string }>();
    const { companies, activeCompany, setActiveCompanyID, clearActiveCompany } = useCompany();
    const navigate = useNavigate();
    const location = useLocation();
    const [refresh, setRefresh] = useState(false);

    useEffect(() => {
        if (companyId && companyId !== activeCompany?.id) {
            const found = companies.find(c => c.id === companyId);
            if (found) setActiveCompanyID(found.id);
            else navigate("/", { replace: true });
        }
    }, [companyId, companies]);

    if (!activeCompany) return null;

    const base = `/${companyId}`;
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
                    <Route path="invoices" element={<InvoiceList refresh={refresh} />} />
                    <Route path="new-invoice" element={
                        <InvoiceForm onAdd={() => { setRefresh(r => !r); navigate(`${base}/invoices`); }} />
                    } />
                    <Route path="edit" element={<EditCompanyPage onSaved={() => navigate(base)} />} />
                    <Route path="*" element={<Navigate to={base} replace />} />
                </Routes>
            </Container>
        </Stack>
    );
};
