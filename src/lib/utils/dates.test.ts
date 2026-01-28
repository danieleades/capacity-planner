import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getNextMonths, formatYearMonth, getCurrentMonth, getMonthsInRange } from './dates';

describe('date utilities', () => {
	describe('getNextMonths', () => {
		beforeEach(() => {
			// Mock the current date to be January 15, 2025
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2025-01-15'));
		});

		it('should return empty array for count 0', () => {
			const result = getNextMonths(0);
			expect(result).toEqual([]);
		});

		it('should return current month for count 1', () => {
			const result = getNextMonths(1);
			expect(result).toEqual(['2025-01']);
		});

		it('should return next N months including current', () => {
			const result = getNextMonths(3);
			expect(result).toEqual(['2025-01', '2025-02', '2025-03']);
		});

		it('should handle year boundary correctly', () => {
			vi.setSystemTime(new Date('2024-11-15'));
			const result = getNextMonths(4);
			expect(result).toEqual(['2024-11', '2024-12', '2025-01', '2025-02']);
		});

		it('should pad single-digit months with zero', () => {
			vi.setSystemTime(new Date('2025-09-15'));
			const result = getNextMonths(3);
			expect(result).toEqual(['2025-09', '2025-10', '2025-11']);
		});

		it('should handle large counts', () => {
			const result = getNextMonths(13);
			expect(result).toHaveLength(13);
			expect(result[0]).toBe('2025-01');
			expect(result[12]).toBe('2026-01'); // 12 months later
		});

		// Critical edge case: dates at end of month
		it('should not skip February when starting on Jan 31', () => {
			vi.setSystemTime(new Date('2025-01-31'));
			const result = getNextMonths(3);
			expect(result).toEqual(['2025-01', '2025-02', '2025-03']);
		});

		it('should not skip months when starting on month-end dates', () => {
			vi.setSystemTime(new Date('2025-03-31'));
			const result = getNextMonths(6);
			expect(result).toEqual([
				'2025-03',
				'2025-04',
				'2025-05',
				'2025-06',
				'2025-07',
				'2025-08'
			]);
		});

		it('should handle leap year Feb 29', () => {
			vi.setSystemTime(new Date('2024-02-29'));
			const result = getNextMonths(4);
			expect(result).toEqual(['2024-02', '2024-03', '2024-04', '2024-05']);
		});

		it('should handle May 31 advancing through months with different lengths', () => {
			vi.setSystemTime(new Date('2025-05-31'));
			const result = getNextMonths(4);
			expect(result).toEqual(['2025-05', '2025-06', '2025-07', '2025-08']);
		});

		afterEach(() => {
			vi.useRealTimers();
		});
	});

	describe('formatYearMonth', () => {
		it('should format YYYY-MM to readable string', () => {
			const result = formatYearMonth('2025-01');
			expect(result).toMatch(/Jan.*2025/);
		});

		it('should handle different months', () => {
			expect(formatYearMonth('2025-03')).toMatch(/Mar.*2025/);
			expect(formatYearMonth('2025-12')).toMatch(/Dec.*2025/);
		});

		it('should handle year changes', () => {
			const result = formatYearMonth('2026-06');
			expect(result).toMatch(/Jun.*2026/);
		});

		it('should handle single-digit months with padding', () => {
			const result = formatYearMonth('2025-09');
			expect(result).toMatch(/Sep.*2025/);
		});
	});

	describe('getCurrentMonth', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		it('should return current month in YYYY-MM format', () => {
			vi.setSystemTime(new Date('2025-01-15'));
			expect(getCurrentMonth()).toBe('2025-01');
		});

		it('should pad single-digit months', () => {
			vi.setSystemTime(new Date('2025-05-20'));
			expect(getCurrentMonth()).toBe('2025-05');
		});

		it('should handle December', () => {
			vi.setSystemTime(new Date('2025-12-31'));
			expect(getCurrentMonth()).toBe('2025-12');
		});

		it('should handle year boundaries', () => {
			vi.setSystemTime(new Date('2024-01-01'));
			expect(getCurrentMonth()).toBe('2024-01');
		});

		afterEach(() => {
			vi.useRealTimers();
		});
	});

	describe('getMonthsInRange', () => {
		it('should return single month when start equals end', () => {
			const result = getMonthsInRange('2025-01', '2025-01');
			expect(result).toEqual(['2025-01']);
		});

		it('should return months in range inclusive', () => {
			const result = getMonthsInRange('2025-01', '2025-03');
			expect(result).toEqual(['2025-01', '2025-02', '2025-03']);
		});

		it('should handle year boundary', () => {
			const result = getMonthsInRange('2024-11', '2025-02');
			expect(result).toEqual(['2024-11', '2024-12', '2025-01', '2025-02']);
		});

		it('should handle multi-year range', () => {
			const result = getMonthsInRange('2024-01', '2026-01');
			expect(result).toHaveLength(25); // 24 months + 1
			expect(result[0]).toBe('2024-01');
			expect(result[24]).toBe('2026-01');
		});

		it('should return empty array when end is before start', () => {
			const result = getMonthsInRange('2025-03', '2025-01');
			expect(result).toEqual([]);
		});
	});

});
