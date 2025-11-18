import type { WorkPackage, Team } from '$lib/types';

export interface TeamBacklogMetrics {
	teamId: string;
	totalWorkMonths: number;
	monthsToComplete: number;
	estimatedCompletionDate: Date | null;
}

/**
 * Get the capacity for a team in a specific month
 */
export function getCapacityForMonth(team: Team, yearMonth: string): number {
	const override = team.capacityOverrides?.find((co) => co.yearMonth === yearMonth);
	return override ? override.capacity : team.monthlyCapacityInPersonMonths;
}

/**
 * Calculate the total work months for a team's assigned work packages
 */
export function calculateTotalWorkMonths(
	teamId: string,
	workPackages: WorkPackage[]
): number {
	return workPackages
		.filter((wp) => wp.assignedTeamId === teamId)
		.reduce((sum, wp) => sum + wp.sizeInPersonMonths, 0);
}

/**
 * Generate year-month string for a date
 */
export function formatYearMonth(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Simulate month-by-month work completion considering variable capacity
 * Returns the estimated completion date or null if work cannot be completed
 *
 * Normalizes to calendar months to avoid date rollover bugs
 * (e.g., starting Jan 31 + 1 month should check Feb, not skip to Mar)
 */
export function simulateWorkCompletion(
	team: Team,
	totalWorkMonths: number,
	startDate: Date = new Date()
): Date | null {
	if (totalWorkMonths <= 0) return null;

	let remainingWork = totalWorkMonths;
	let monthsElapsed = 0;
	// Normalize to 1st of the month to avoid date rollover issues
	const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
	const maxMonths = 240; // 20 years

	while (remainingWork > 0 && monthsElapsed < maxMonths) {
		const yearMonth = formatYearMonth(currentDate);
		const monthCapacity = getCapacityForMonth(team, yearMonth);

		// Skip months with zero capacity instead of aborting
		// This allows future capacity overrides to be honored
		if (monthCapacity > 0) {
			remainingWork -= monthCapacity;
		}

		// If work is complete, return current month (not next month)
		if (remainingWork <= 0) {
			return new Date(currentDate);
		}

		monthsElapsed++;
		// Advance by setting to 1st of next month to avoid rollover bugs
		currentDate.setMonth(currentDate.getMonth() + 1);
		currentDate.setDate(1);
	}

	return null; // Could not complete within maxMonths
}

/**
 * Calculate backlog metrics for a team with variable capacity support
 * Uses simulation to ensure monthsToComplete matches estimatedCompletionDate
 * 
 * Performance: If workPackages are already filtered for this team, pass preFiltered=true
 * to skip redundant filtering (O(1) vs O(n))
 */
export function calculateTeamBacklog(
	team: Team, 
	workPackages: WorkPackage[],
	preFiltered: boolean = false
): TeamBacklogMetrics {
	// Optimization: Skip filtering if workPackages are already filtered for this team
	const totalWorkMonths = preFiltered
		? workPackages.reduce((sum, wp) => sum + wp.sizeInPersonMonths, 0)
		: calculateTotalWorkMonths(team.id, workPackages);

	if (totalWorkMonths <= 0) {
		return {
			teamId: team.id,
			totalWorkMonths: 0,
			monthsToComplete: 0,
			estimatedCompletionDate: null,
		};
	}

	// Simulate month-by-month to get accurate metrics with variable capacity
	let remainingWork = totalWorkMonths;
	let monthsWithCapacity = 0;
	const currentDate = new Date();
	currentDate.setDate(1); // Normalize to 1st of month
	const maxMonths = 240; // 20 years

	let estimatedCompletionDate: Date | null = null;

	for (let i = 0; i < maxMonths && remainingWork > 0; i++) {
		const yearMonth = formatYearMonth(currentDate);
		const monthCapacity = getCapacityForMonth(team, yearMonth);

		if (monthCapacity > 0) {
			remainingWork -= monthCapacity;
			monthsWithCapacity++;

			// Capture completion date when work finishes
			if (remainingWork <= 0) {
				estimatedCompletionDate = new Date(currentDate);
				break;
			}
		}

		currentDate.setMonth(currentDate.getMonth() + 1);
		currentDate.setDate(1);
	}

	const monthsToComplete = remainingWork <= 0 ? monthsWithCapacity : Infinity;

	return {
		teamId: team.id,
		totalWorkMonths,
		monthsToComplete,
		estimatedCompletionDate,
	};
}

/**
 * Format months as a human-readable string
 */
export function formatMonths(months: number): string {
	if (!isFinite(months)) return '∞';
	if (months < 1) return `${Math.ceil(months * 4)} weeks`;
	if (months < 12) return `${months.toFixed(1)} months`;
	const years = Math.floor(months / 12);
	const remainingMonths = Math.round(months % 12);
	if (remainingMonths === 0) return `${years} ${years === 1 ? 'year' : 'years'}`;
	return `${years}y ${remainingMonths}m`;
}

/**
 * Format date as a readable string
 */
export function formatDate(date: Date | null): string {
	if (!date) return 'Never';
	return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
