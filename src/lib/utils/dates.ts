import { YearMonth } from '$lib/types';

/**
 * Get the next N months starting from a base date in YYYY-MM format
 */
export function getNextMonthsFrom(baseDate: Date, count: number): string[] {
	return YearMonth.fromDate(baseDate).next(count).map((ym) => ym.toString());
}

/**
 * Get the next N months starting from today in YYYY-MM format
 */
export function getNextMonths(count: number): string[] {
	return YearMonth.current().next(count).map((ym) => ym.toString());
}

/**
 * Format YYYY-MM to readable month string (e.g., "Jan 2025")
 */
export function formatYearMonth(yearMonth: string): string {
	return YearMonth.parse(yearMonth).format();
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
	return YearMonth.current().toString();
}

/**
 * Get months in a range from startMonth to endMonth (inclusive)
 * Both parameters should be in YYYY-MM format
 */
export function getMonthsInRange(startMonth: string, endMonth: string): string[] {
	const start = YearMonth.parse(startMonth);
	const end = YearMonth.parse(endMonth);
	return start.rangeTo(end).map((ym) => ym.toString());
}

/**
 * Calculate the number of months between two YYYY-MM dates (inclusive)
 * Returns negative if end is before start
 */
export function monthsBetween(startMonth: string, endMonth: string): number {
	const start = YearMonth.parse(startMonth);
	const end = YearMonth.parse(endMonth);
	// Formula: (endYear - startYear) * 12 + (endMonth - startMonth) + 1
	return (end.year - start.year) * 12 + (end.month - start.month) + 1;
}
