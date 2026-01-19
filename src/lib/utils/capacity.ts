import { YearMonth, type WorkPackage, type Team } from '$lib/types';

export interface TeamBacklogMetrics {
	teamId: string;
	totalWorkMonths: number;
	remainingWorkMonths: number;
	monthsToComplete: number;
	estimatedCompletionDate: Date | null;
}

/**
 * Calculate remaining work for a work package based on progress
 */
export function getRemainingWork(wp: WorkPackage): number {
	const progress = wp.progressPercent ?? 0;
	return wp.sizeInPersonMonths * (1 - progress / 100);
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
 * Calculate the remaining work months for a team's assigned work packages
 * Takes progress into account
 */
export function calculateRemainingWorkMonths(
	teamId: string,
	workPackages: WorkPackage[]
): number {
	return workPackages
		.filter((wp) => wp.assignedTeamId === teamId)
		.reduce((sum, wp) => sum + getRemainingWork(wp), 0);
}

/**
 * Convert a Date to YYYY-MM format string
 */
export function toYearMonth(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Sort work packages by scheduled position (for board view) with fallback to priority
 * Returns a new sorted array without mutating the original
 */
export function sortByScheduledPosition(workPackages: WorkPackage[]): WorkPackage[] {
	return [...workPackages].sort((a, b) => {
		const posA = a.scheduledPosition ?? a.priority;
		const posB = b.scheduledPosition ?? b.priority;
		return posA - posB;
	});
}

/**
 * Group work packages by their assigned team
 * Returns a map of teamId -> work packages, plus an array of unassigned work packages
 */
export function groupWorkPackagesByTeam(workPackages: WorkPackage[]): {
	byTeam: Map<string, WorkPackage[]>;
	unassigned: WorkPackage[];
} {
	const byTeam = new Map<string, WorkPackage[]>();
	const unassigned: WorkPackage[] = [];

	for (const wp of workPackages) {
		if (wp.assignedTeamId) {
			const existing = byTeam.get(wp.assignedTeamId);
			if (existing) {
				existing.push(wp);
			} else {
				byTeam.set(wp.assignedTeamId, [wp]);
			}
		} else {
			unassigned.push(wp);
		}
	}

	return { byTeam, unassigned };
}

/**
 * Simulate month-by-month work completion considering variable capacity
 * Returns the estimated completion date (with precise day) or null if work cannot be completed
 *
 * The returned date reflects the actual day within the month when work completes,
 * based on the fraction of month capacity used.
 */
export function simulateWorkCompletion(
	team: Team,
	totalWorkMonths: number,
	startDate: Date = new Date()
): Date | null {
	if (totalWorkMonths <= 0) return null;

	let remainingWork = totalWorkMonths;
	let monthsElapsed = 0;
	const currentYearMonth = YearMonth.fromDate(startDate);
	let currentMonth = currentYearMonth;
	const maxMonths = 240; // 20 years

	while (remainingWork > 0 && monthsElapsed < maxMonths) {
		const monthCapacity = getCapacityForMonth(team, currentMonth.toString());

		// Skip months with zero capacity
		if (monthCapacity > 0) {
			const workBefore = remainingWork;
			remainingWork -= monthCapacity;

			// If work completes this month, calculate precise day
			if (remainingWork <= 0) {
				const workDoneThisMonth = workBefore;
				const fractionOfMonth = workDoneThisMonth / monthCapacity;
				const daysInMonth = currentMonth.daysInMonth();
				const completionDay = Math.round(fractionOfMonth * daysInMonth);
				// Clamp to valid day range (1 to daysInMonth)
				const day = Math.max(1, Math.min(completionDay, daysInMonth));
				return new Date(currentMonth.year, currentMonth.month - 1, day);
			}
		}

		monthsElapsed++;
		currentMonth = currentMonth.addMonths(1);
	}

	return null; // Could not complete within maxMonths
}

/**
 * Calculate backlog metrics for a team with variable capacity support
 * Uses simulation to ensure monthsToComplete matches estimatedCompletionDate
 *
 * Performance: If workPackages are already filtered for this team, pass preFiltered=true
 * to skip redundant filtering (O(1) vs O(n))
 *
 * @param startDate - When to start scheduling (defaults to today)
 */
export function calculateTeamBacklog(
	team: Team,
	workPackages: WorkPackage[],
	preFiltered: boolean = false,
	startDate: Date = new Date()
): TeamBacklogMetrics {
	// Optimization: Skip filtering if workPackages are already filtered for this team
	const totalWorkMonths = preFiltered
		? workPackages.reduce((sum, wp) => sum + wp.sizeInPersonMonths, 0)
		: calculateTotalWorkMonths(team.id, workPackages);

	// Calculate remaining work (accounting for progress)
	const remainingWorkMonths = preFiltered
		? workPackages.reduce((sum, wp) => sum + getRemainingWork(wp), 0)
		: calculateRemainingWorkMonths(team.id, workPackages);

	if (remainingWorkMonths <= 0) {
		return {
			teamId: team.id,
			totalWorkMonths,
			remainingWorkMonths: 0,
			monthsToComplete: 0,
			estimatedCompletionDate: null,
		};
	}

	// Simulate month-by-month to get accurate metrics with variable capacity
	// Use remainingWorkMonths for scheduling (not totalWorkMonths)
	let remainingWork = remainingWorkMonths;
	let monthsWithCapacity = 0;
	const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
	const maxMonths = 240; // 20 years

	let estimatedCompletionDate: Date | null = null;

	for (let i = 0; i < maxMonths && remainingWork > 0; i++) {
		const yearMonth = toYearMonth(currentDate);
		const monthCapacity = getCapacityForMonth(team, yearMonth);

		if (monthCapacity > 0) {
			const workBefore = remainingWork;
			remainingWork -= monthCapacity;

			// Capture completion date when work finishes
			if (remainingWork <= 0) {
				// Calculate precise completion - only count fractional month used
				const fractionOfMonth = workBefore / monthCapacity;
				monthsWithCapacity += fractionOfMonth;

				// Calculate precise completion day based on fraction of month's capacity used
				const daysInMonth = new Date(
					currentDate.getFullYear(),
					currentDate.getMonth() + 1,
					0
				).getDate();
				const completionDay = Math.round(fractionOfMonth * daysInMonth);
				const day = Math.max(1, Math.min(completionDay, daysInMonth));
				estimatedCompletionDate = new Date(
					currentDate.getFullYear(),
					currentDate.getMonth(),
					day
				);
				break;
			}

			// Full month consumed, continue to next
			monthsWithCapacity++;
		}

		currentDate.setMonth(currentDate.getMonth() + 1);
		currentDate.setDate(1);
	}

	const monthsToComplete = remainingWork <= 0 ? monthsWithCapacity : Infinity;

	return {
		teamId: team.id,
		totalWorkMonths,
		remainingWorkMonths,
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

/**
 * Scheduled work package with calculated start and end dates
 * Uses precise Date objects (day-level) as single source of truth
 */
export interface ScheduledWorkPackage {
	workPackage: WorkPackage;
	startDate: Date;
	endDate: Date;
}

/**
 * Calculate the schedule for work packages assigned to a team
 * Work packages are scheduled sequentially (finish-to-start) based on scheduledPosition/priority
 *
 * Uses precise day-level tracking:
 * - If WP-A finishes Feb 15, WP-B starts Feb 15
 * - Tracks fractional day position within months
 * - Returns precise Date objects for start/end
 *
 * @param team - The team to schedule work for
 * @param workPackages - Work packages assigned to this team (should be pre-filtered)
 * @param startDate - When to start scheduling (defaults to today)
 * @returns Array of work packages with their scheduled start/end dates
 */
export function calculateTeamSchedule(
	team: Team,
	workPackages: WorkPackage[],
	startDate: Date = new Date()
): ScheduledWorkPackage[] {
	const sorted = sortByScheduledPosition(workPackages);
	const schedule: ScheduledWorkPackage[] = [];

	// Track position as: which month + fraction of month consumed (0.0 to 1.0)
	let currentMonth = YearMonth.fromDate(startDate);
	let fractionConsumedInMonth = 0; // 0.0 = start of month, 1.0 = end of month

	const maxMonths = 240;
	let monthsProcessed = 0;

	for (const wp of sorted) {
		let remainingWork = getRemainingWork(wp);
		if (remainingWork <= 0) continue;

		// Capture precise start date
		const wpStartDate = fractionToDate(currentMonth, fractionConsumedInMonth);
		let wpEndDate = wpStartDate;

		// Consume capacity month by month until work is complete
		while (remainingWork > 0 && monthsProcessed < maxMonths) {
			const monthCapacity = getCapacityForMonth(team, currentMonth.toString());

			// Skip months with zero capacity
			if (monthCapacity <= 0) {
				currentMonth = currentMonth.addMonths(1);
				fractionConsumedInMonth = 0;
				monthsProcessed++;
				continue;
			}

			// Available capacity in current month (accounting for what's already consumed)
			const availableCapacity = monthCapacity * (1 - fractionConsumedInMonth);

			if (availableCapacity <= 0) {
				// Move to next month
				currentMonth = currentMonth.addMonths(1);
				fractionConsumedInMonth = 0;
				monthsProcessed++;
				continue;
			}

			const workDoneThisMonth = Math.min(remainingWork, availableCapacity);
			remainingWork -= workDoneThisMonth;

			// Update fraction consumed
			const fractionUsed = workDoneThisMonth / monthCapacity;
			fractionConsumedInMonth += fractionUsed;

			// Capture end date at current position
			wpEndDate = fractionToDate(currentMonth, fractionConsumedInMonth);

			// If month is fully consumed and more work remains, move to next
			if (fractionConsumedInMonth >= 1 - 1e-9 && remainingWork > 0) {
				currentMonth = currentMonth.addMonths(1);
				fractionConsumedInMonth = 0;
				monthsProcessed++;
			}
		}

		// Only add if we could complete the work
		if (remainingWork <= 0) {
			schedule.push({
				workPackage: wp,
				startDate: wpStartDate,
				endDate: wpEndDate,
			});
		}
	}

	return schedule;
}

/**
 * Convert a month + fraction to a precise Date
 * @param month - The year-month
 * @param fraction - Fraction of month's capacity consumed (0.0 to 1.0)
 */
function fractionToDate(month: YearMonth, fraction: number): Date {
	const daysInMonth = month.daysInMonth();
	// fraction 0 = day 1, fraction 1 = last day
	// Scale: 0% = day 1, 50% = day 14 (for 28-day month), 100% = day 28
	const day = Math.max(1, Math.min(Math.ceil(fraction * daysInMonth), daysInMonth));
	return new Date(month.year, month.month - 1, day);
}

/**
 * Card height scaling configuration
 */
export const CARD_HEIGHT_CONFIG = {
	minHeight: 80, // px - minimum height for card content
	maxHeight: 500, // px - maximum at full scaling intensity
} as const;

/**
 * Calculate the visual height of a work package card based on remaining work
 * Uses clamped linear scaling relative to the global maximum
 *
 * @param remainingWork - Remaining work for this work package
 * @param globalMaxRemainingWork - Maximum remaining work across all work packages
 * @param scalingIntensity - Scaling intensity from 0 (no scaling) to 100 (full scaling)
 * @returns Height in pixels
 */
export function calculateCardHeight(
	remainingWork: number,
	globalMaxRemainingWork: number,
	scalingIntensity: number = 100
): number {
	const { minHeight, maxHeight } = CARD_HEIGHT_CONFIG;

	if (globalMaxRemainingWork <= 0 || scalingIntensity <= 0) return minHeight;

	// Effective max height based on scaling intensity (0-100%)
	const effectiveMaxHeight = minHeight + (maxHeight - minHeight) * (scalingIntensity / 100);

	// Linear scaling: 0 remaining -> minHeight, max remaining -> effectiveMaxHeight
	const scale = Math.min(remainingWork / globalMaxRemainingWork, 1);
	return minHeight + scale * (effectiveMaxHeight - minHeight);
}
