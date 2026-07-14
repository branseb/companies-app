import { IconButton, Stack, Tooltip } from "@mui/material";
import { Close, DarkMode, LightMode, Minimize, Terminal } from "@mui/icons-material";
import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useCompany } from "./context/company";
import { useThemeMode } from "./context/theme";
import { useFirebaseAuth } from "./context/firebaseAuth";
import { useChat } from "./hooks/useChat";
import { useNewDocuments } from "./hooks/useNewDocuments";
import { SelectCompanyPage } from "./pages/SelectCompanyPage";
import { CompanyDashboard } from "./pages/CompanyDashboard";

// Module-level state survives React remounts and HMR
const _seenIds:   Map<string, Set<string>> = new Map()
const _timers:    Map<string, ReturnType<typeof setTimeout>> = new Map()
const _lastNotif: Map<string, number> = new Map()

function CompanyNotificationListener({ configId, companyName }: { configId: string; companyName: string }) {
    const { messages } = useChat(configId, "accountant", true);
    const docIds = useNewDocuments(configId, true);
    const unread = messages.filter(m => m.from === "company" && !m.readByAccountant).length;

    const prevUnread = useRef<number | null>(null);

    useEffect(() => {
        if (prevUnread.current === null) { prevUnread.current = unread; return; }
        if (unread > prevUnread.current)
            window.api.notification.show("Nová správa", `${companyName} poslala správu`);
        prevUnread.current = unread;
    }, [unread]);

    useEffect(() => {
        if (docIds === null) return; // not yet loaded — establish baseline on first snapshot

        if (!_seenIds.has(configId)) {
            // First load: remember all existing IDs as baseline, no notification
            _seenIds.set(configId, new Set(docIds));
            return;
        }

        const seen = _seenIds.get(configId)!;
        const newOnes = docIds.filter(id => !seen.has(id));
        docIds.forEach(id => seen.add(id));

        if (newOnes.length === 0) return;

        // Debounce: reset timer on each new document
        const existing = _timers.get(configId);
        if (existing) clearTimeout(existing);

        const t = setTimeout(() => {
            _timers.delete(configId);
            const last = _lastNotif.get(configId) ?? 0;
            if (Date.now() - last >= 30_000) {
                _lastNotif.set(configId, Date.now());
                window.api.notification.show("Nové dokumenty", `${companyName} nahrala nové dokumenty`);
            }
        }, 3_000);
        _timers.set(configId, t);
    }, [docIds, configId]);

    return null;
}

function NotificationListener() {
    const { companyConfigs } = useCompany();
    const { fbUser } = useFirebaseAuth();

    if (!fbUser) return null;

    return (
        <>
            {companyConfigs.map(c => (
                <CompanyNotificationListener key={c.id} configId={c.id} companyName={c.name} />
            ))}
        </>
    );
}

const App = () => {
	const { activeCompany, activeConfigId } = useCompany();

	return (
		<Stack height="100vh" width="100vw" overflow="hidden">
			<NotificationListener />
			<WindowBar />
			<Routes>
				<Route path="/" element={
					activeCompany && activeConfigId
						? <Navigate to={`/${activeConfigId}`} replace />
						: <SelectCompanyPage />
				} />
				<Route path="/:configId/*" element={<CompanyDashboard />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</Stack>
	);
};

const WindowBar = () => {
	const { mode, toggleMode } = useThemeMode();
	const isMac = window.electron.platform === 'darwin';

	return (
		<Stack
			sx={{ "-webkit-app-region": "drag", background: mode === "dark" ? "#1E293B" : "#E2E8F0", flexShrink: 0 }}
			width="100%"
			direction="row"
			justifyContent="end"
			alignItems="center"
			pl={isMac ? '80px' : 0}
		>
			<Tooltip title={mode === "dark" ? "Svetlý režim" : "Tmavý režim"}>
				<IconButton sx={{ "-webkit-app-region": "no-drag" }} onClick={toggleMode}>
					{mode === "dark" ? <LightMode /> : <DarkMode />}
				</IconButton>
			</Tooltip>
			<IconButton sx={{ "-webkit-app-region": "no-drag" }} onClick={() => window.electron.window.devtools()}>
				<Terminal />
			</IconButton>
			{!isMac && <>
				<IconButton sx={{ "-webkit-app-region": "no-drag" }} onClick={() => window.electron.window.minimize()}>
					<Minimize />
				</IconButton>
				<IconButton sx={{ "-webkit-app-region": "no-drag" }} onClick={() => window.electron.window.close()}>
					<Close />
				</IconButton>
			</>}
		</Stack>
	);
};

export default App;
