import { IconButton, Stack } from "@mui/material";
import { Close, Minimize, Terminal } from "@mui/icons-material";
import { Navigate, Route, Routes, useNavigation } from "react-router-dom";
import { useCompany } from "./context/company";
import { SelectCompanyPage } from "./pages/SelectCompanyPage";
import { CompanyDashboard } from "./pages/CompanyDashboard";

const App = () => {
	const { activeCompany } = useCompany();

	return (
		<Stack height="100vh" width="100vw" overflow="hidden">
			<WindowBar />
			<Routes>
				<Route path="/" element={
					activeCompany
						? <Navigate to={`/${activeCompany.id}`} replace />
						: <SelectCompanyPage />
				} />
				<Route path="/:companyId/*" element={<CompanyDashboard />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</Stack>
	);
};

const WindowBar = () => (
	<Stack
		sx={{ "-webkit-app-region": "drag", background: "silver", flexShrink: 0 }}
		width="100%"
		direction="row"
		justifyContent="end"
		alignItems="start"
	>
		<IconButton sx={{ "-webkit-app-region": "no-drag" }} onClick={() => window.electron.window.devtools()}>
			<Terminal />
		</IconButton>
		<IconButton sx={{ "-webkit-app-region": "no-drag" }} onClick={() => window.electron.window.minimize()}>
			<Minimize />
		</IconButton>
		<IconButton sx={{ "-webkit-app-region": "no-drag" }} onClick={() => window.electron.window.close()}>
			<Close />
		</IconButton>
	</Stack>
);

export default App;
