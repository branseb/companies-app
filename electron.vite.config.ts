import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		resolve: {
			alias: {
				'@e-companies/shared': path.resolve(__dirname, '../e-companies-shared'),
			},
		},
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
		resolve: {
			alias: {
				'@e-companies/shared': path.resolve(__dirname, '../e-companies-shared'),
			},
		},
	},
});
