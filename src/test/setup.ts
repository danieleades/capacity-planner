import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test case
afterEach(() => {
	cleanup();
});

// Setup custom matchers
expect.extend({});
