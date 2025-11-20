import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

// Suppress console.error during tests to avoid noise from expected error cases
beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Cleanup after each test case
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

// Setup custom matchers
expect.extend({});
