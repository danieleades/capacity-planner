/**
 * Get the next N months starting from today in YYYY-MM format
 * Normalizes to the 1st of each month to avoid date rollover issues
 * (e.g., Jan 31 + 1 month would incorrectly become Mar 3, not Feb 1)
 */
export function getNextMonthsFrom(baseDate: Date, count: number): string[] {
	const months: string[] = [];

	// Normalize to 1st of current month to avoid rollover bugs
	const normalizedBaseDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);

	for (let i = 0; i < count; i++) {
		const date = new Date(normalizedBaseDate.getFullYear(), normalizedBaseDate.getMonth() + i, 1);

		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		months.push(`${year}-${month}`);
	}

	return months;
}

/**
 * Get the next N months starting from today in YYYY-MM format
 * Normalizes to the 1st of each month to avoid date rollover issues
 * (e.g., Jan 31 + 1 month would incorrectly become Mar 3, not Feb 1)
 */
export function getNextMonths(count: number): string[] {
	return getNextMonthsFrom(new Date(), count);
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

/**
 * Get months in a range from startMonth to endMonth (inclusive)
 * Both parameters should be in YYYY-MM format
 */
export function getMonthsInRange(startMonth: string, endMonth: string): string[] {
	const months: string[] = [];

	const [startYear, startMo] = startMonth.split('-').map(Number);
	const [endYear, endMo] = endMonth.split('-').map(Number);

	let currentDate = new Date(startYear, startMo - 1, 1);
	const endDate = new Date(endYear, endMo - 1, 1);

	while (currentDate <= endDate) {
		const year = currentDate.getFullYear();
		const month = String(currentDate.getMonth() + 1).padStart(2, '0');
		months.push(`${year}-${month}`);

		currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
	}

	return months;
}

/**
 * Calculate the number of months between two YYYY-MM dates (inclusive)
 */
export function monthsBetween(startMonth: string, endMonth: string): number {
	const [startYear, startMo] = startMonth.split('-').map(Number);
	const [endYear, endMo] = endMonth.split('-').map(Number);

	return (endYear - startYear) * 12 + (endMo - startMo) + 1;
}
