import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { CompanyProvider } from './context/company.tsx';
import { AppThemeProvider } from './context/theme.tsx';
import { GlobalErrorSnackbar } from './components/GlobalErrorSnackbar.tsx';
import './types.ts'

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<AppThemeProvider>
			<HashRouter>
				<CompanyProvider>
					<App />
					<GlobalErrorSnackbar />
				</CompanyProvider>
			</HashRouter>
		</AppThemeProvider>
	</StrictMode>,
)
