import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { resolve } from 'path';

export default defineConfig({
	plugins: [
		sveltekit(),
		svelteTesting(),
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
		pool: 'threads',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'src/test/',
				'**/*.d.ts',
				'**/*.config.*',
				'**/mockData.ts',
				'.svelte-kit/',
			],
		},
	},
	resolve: {
		alias: {
			$lib: resolve(__dirname, './src/lib'),
			$app: resolve(__dirname, './src/test/mocks/app'),
		},
	},
});
