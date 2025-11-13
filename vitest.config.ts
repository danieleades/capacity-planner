import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
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
			$app: resolve(__dirname, './node_modules/@sveltejs/kit/src/runtime/app'),
		},
	},
});
