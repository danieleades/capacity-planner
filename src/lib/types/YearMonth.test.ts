import { describe, it, expect } from 'vitest';
import { YearMonth } from './YearMonth';

describe('YearMonth', () => {
	describe('constructor', () => {
		it('creates a valid YearMonth', () => {
			const ym = new YearMonth(2025, 2);
			expect(ym.year).toBe(2025);
			expect(ym.month).toBe(2);
		});

		it('throws for invalid month < 1', () => {
			expect(() => new YearMonth(2025, 0)).toThrow('Month must be an integer between 1-12');
		});

		it('throws for invalid month > 12', () => {
			expect(() => new YearMonth(2025, 13)).toThrow('Month must be an integer between 1-12');
		});

		it('throws for non-integer year', () => {
			expect(() => new YearMonth(2025.5, 1)).toThrow('Year must be an integer');
		});
	});

	describe('fromDate', () => {
		it('creates from Date', () => {
			const date = new Date(2025, 1, 15); // Feb 15, 2025
			const ym = YearMonth.fromDate(date);
			expect(ym.year).toBe(2025);
			expect(ym.month).toBe(2);
		});
	});

	describe('parse', () => {
		it('parses valid YYYY-MM string', () => {
			const ym = YearMonth.parse('2025-02');
			expect(ym.year).toBe(2025);
			expect(ym.month).toBe(2);
		});

		it('throws for invalid format', () => {
			expect(() => YearMonth.parse('2025/02')).toThrow('Invalid YearMonth format');
			expect(() => YearMonth.parse('25-02')).toThrow('Invalid YearMonth format');
			expect(() => YearMonth.parse('2025-2')).toThrow('Invalid YearMonth format');
		});
	});

	describe('toString', () => {
		it('returns YYYY-MM format', () => {
			expect(new YearMonth(2025, 2).toString()).toBe('2025-02');
			expect(new YearMonth(2025, 12).toString()).toBe('2025-12');
		});
	});

	describe('toDate', () => {
		it('returns 1st of the month', () => {
			const date = new YearMonth(2025, 2).toDate();
			expect(date.getFullYear()).toBe(2025);
			expect(date.getMonth()).toBe(1); // 0-indexed
			expect(date.getDate()).toBe(1);
		});
	});

	describe('format', () => {
		it('returns human-readable format', () => {
			expect(new YearMonth(2025, 1).format()).toBe('Jan 2025');
			expect(new YearMonth(2025, 12).format()).toBe('Dec 2025');
		});
	});

	describe('daysInMonth', () => {
		it('returns correct days for various months', () => {
			expect(new YearMonth(2025, 1).daysInMonth()).toBe(31); // January
			expect(new YearMonth(2025, 2).daysInMonth()).toBe(28); // February (non-leap)
			expect(new YearMonth(2024, 2).daysInMonth()).toBe(29); // February (leap)
			expect(new YearMonth(2025, 4).daysInMonth()).toBe(30); // April
		});
	});

	describe('addMonths', () => {
		it('adds months within same year', () => {
			const ym = new YearMonth(2025, 3).addMonths(2);
			expect(ym.toString()).toBe('2025-05');
		});

		it('crosses year boundary forward', () => {
			const ym = new YearMonth(2025, 11).addMonths(3);
			expect(ym.toString()).toBe('2026-02');
		});

		it('subtracts months', () => {
			const ym = new YearMonth(2025, 3).addMonths(-2);
			expect(ym.toString()).toBe('2025-01');
		});

		it('crosses year boundary backward', () => {
			const ym = new YearMonth(2025, 2).addMonths(-3);
			expect(ym.toString()).toBe('2024-11');
		});
	});

	describe('compareTo', () => {
		it('returns 0 for equal months', () => {
			expect(new YearMonth(2025, 2).compareTo(new YearMonth(2025, 2))).toBe(0);
		});

		it('returns negative when this < other', () => {
			expect(new YearMonth(2025, 2).compareTo(new YearMonth(2025, 3))).toBeLessThan(0);
			expect(new YearMonth(2024, 12).compareTo(new YearMonth(2025, 1))).toBeLessThan(0);
		});

		it('returns positive when this > other', () => {
			expect(new YearMonth(2025, 3).compareTo(new YearMonth(2025, 2))).toBeGreaterThan(0);
			expect(new YearMonth(2025, 1).compareTo(new YearMonth(2024, 12))).toBeGreaterThan(0);
		});
	});

	describe('toJSON', () => {
		it('returns YYYY-MM string for JSON serialization', () => {
			const ym = new YearMonth(2025, 2);
			expect(JSON.stringify({ month: ym })).toBe('{"month":"2025-02"}');
		});
	});
});
