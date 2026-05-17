import { IconButton, Stack, Tooltip } from "@mui/material";
import { Close, DarkMode, LightMode, Minimize, Terminal } from "@mui/icons-material";
import { Navigate, Route, Routes } from "react-router-dom";
import { useCompany } from "./context/company";
import { useThemeMode } from "./context/theme";
import { SelectCompanyPage } from "./pages/SelectCompanyPage";
import { CompanyDashboard } from "./pages/CompanyDashboard";

const App = () => {
	const { activeCompany, activeConfigId } = useCompany();

	return (
		<Stack height="100vh" width="100vw" overflow="hidden">
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
			sx={{ "-webkit-app-region": "drag", background: mode === "dark" ? "#1e1e1e" : "silver", flexShrink: 0 }}
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
