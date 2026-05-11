import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { CompanyProvider } from './context/company.tsx';
import './types.ts'

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<HashRouter>
			<CompanyProvider>
				<App />
			</CompanyProvider>
		</HashRouter>
	</StrictMode>,
)
