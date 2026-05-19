import { Badge, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Add, Chat, Folder } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../context/company";
import { useFirebaseAuth } from "../context/firebaseAuth";
import { useChat } from "../hooks/useChat";
import { useNewDocuments } from "../hooks/useNewDocuments";
import { CompaniesDialog } from "../components/companiesDialog";

function CompanyCardBadges({ configId }: { configId: string }) {
    const { fbUser } = useFirebaseAuth();
    const { messages } = useChat(configId, "accountant", !!fbUser);
    const docs = useNewDocuments(configId, !!fbUser);
    const msgs = fbUser ? messages.filter(m => m.from === "company" && !m.readByAccountant).length : 0;

    if (!fbUser || (msgs === 0 && docs === 0)) return null;

    return (
        <Stack direction="row" gap={1.5} position="absolute" right={16} top="50%" sx={{ transform: "translateY(-50%)" }}>
            {msgs > 0 && (
                <Badge badgeContent={msgs} color="error">
                    <Chat fontSize="small" sx={{ color: "text.secondary" }} />
                </Badge>
            )}
            {docs > 0 && (
                <Badge badgeContent={docs} color="error">
                    <Folder fontSize="small" sx={{ color: "text.secondary" }} />
                </Badge>
            )}
        </Stack>
    );
}

export const SelectCompanyPage = () => {
    const { companyConfigs, configsLoaded, selectConfig } = useCompany();
    const navigate = useNavigate();
    const [openDialog, setOpenDialog] = useState(false);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSelect = async (configId: string) => {
        const config = companyConfigs.find(c => c.id === configId);
        if (!config) return;
        setConnecting(configId);
        setError(null);
        try {
            await selectConfig(config);
            navigate(`/${configId}`);
        } catch (e: any) {
            setError(`Chyba pripojenia: ${e.message}`);
        } finally {
            setConnecting(null);
        }
    };

    if (!configsLoaded) {
        return (
            <Stack height="100%" alignItems="center" justifyContent="center">
                <CircularProgress />
            </Stack>
        );
    }

    return (
        <Stack height="100%" alignItems="center" justifyContent="center" gap={4}>
            <Typography variant="h4" fontWeight={700}>
                Vyberte firmu
            </Typography>

            <Stack gap={2} width="100%" maxWidth={400}>
                {companyConfigs.map((c) => (
                    <Box
                        key={c.id}
                        onClick={() => handleSelect(c.id)}
                        sx={{
                            p: 2.5,
                            borderRadius: 2,
                            cursor: connecting ? "not-allowed" : "pointer",
                            border: "1px solid",
                            borderColor: "grey.300",
                            "&:hover": { borderColor: "primary.main", backgroundColor: "primary.50" },
                            transition: "all 0.15s",
                            opacity: connecting && connecting !== c.id ? 0.5 : 1,
                            position: "relative",
                        }}
                    >
                        <Typography fontWeight={600} fontSize={16}>{c.name}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                            {(() => { try { return new URL(c.connectionString).hostname; } catch { return c.connectionString; } })()}
                        </Typography>
                        {connecting === c.id
                            ? <CircularProgress size={18} sx={{ position: "absolute", right: 16, top: "50%", mt: "-9px" }} />
                            : <CompanyCardBadges configId={c.id} />
                        }
                    </Box>
                ))}

                {companyConfigs.length === 0 && (
                    <Typography color="text.secondary" textAlign="center">
                        Žiadne firmy. Pridajte prvú firmu.
                    </Typography>
                )}
            </Stack>

            {error && (
                <Typography color="error" variant="body2">{error}</Typography>
            )}

            <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setOpenDialog(true)}
            >
                Pridať firmu
            </Button>

            <CompaniesDialog open={openDialog} onClose={() => setOpenDialog(false)} />
        </Stack>
    );
};
