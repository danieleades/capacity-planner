/**
 * Get the next N months starting from today in YYYY-MM format
 * Normalizes to the 1st of each month to avoid date rollover issues
 * (e.g., Jan 31 + 1 month would incorrectly become Mar 3, not Feb 1)
 */
export function getNextMonths(count: number): string[] {
	const months: string[] = [];
	const today = new Date();

	// Normalize to 1st of current month to avoid rollover bugs
	const baseDate = new Date(today.getFullYear(), today.getMonth(), 1);

	for (let i = 0; i < count; i++) {
		const date = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);

		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		months.push(`${year}-${month}`);
	}

	return months;
}

/**
 * Format YYYY-MM to readable month string (e.g., "Jan 2025")
 */
export function formatYearMonth(yearMonth: string): string {
	const [year, month] = yearMonth.split('-');
	const date = new Date(parseInt(year), parseInt(month) - 1, 1);

	return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	return `${year}-${month}`;
}
