import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		build: {
			rollupOptions: {
				output: {
					preserveModules: true,
					preserveModulesRoot: 'src/main',
				},
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
	},
	renderer: {
		plugins: [react()],
	},
});
