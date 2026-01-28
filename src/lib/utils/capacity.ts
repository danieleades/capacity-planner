import { YearMonth, type WorkPackage, type Team, type TeamId } from '$lib/types';
import { CapacityCalendar } from './CapacityCalendar';

export interface TeamBacklogMetrics {
	teamId: TeamId;
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
export function getCapacityForMonth(team: Team, yearMonth: YearMonth | string): number {
	const yearMonthStr = typeof yearMonth === 'string' ? yearMonth : yearMonth.toString();
	const override = team.capacityOverrides?.find((co) => co.yearMonth === yearMonthStr);
	return override ? override.capacity : team.monthlyCapacityInPersonMonths;
}

/**
 * Calculate the total work months for a team's assigned work packages
 */
export function calculateTotalWorkMonths(
	teamId: TeamId,
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
	teamId: TeamId,
	workPackages: WorkPackage[]
): number {
	return workPackages
		.filter((wp) => wp.assignedTeamId === teamId)
		.reduce((sum, wp) => sum + getRemainingWork(wp), 0);
}

/**
 * Generic comparator for items with scheduled position and priority.
 * Uses scheduledPosition if available, falling back to priority.
 */
export function scheduledPositionComparator<T extends { scheduledPosition?: number | null; priority: number }>(
	a: T,
	b: T
): number {
	const posA = a.scheduledPosition ?? a.priority;
	const posB = b.scheduledPosition ?? b.priority;
	return posA - posB;
}

/**
 * Sort work packages by scheduled position (for board view) with fallback to priority
 * Returns a new sorted array without mutating the original
 */
export function sortByScheduledPosition(workPackages: WorkPackage[]): WorkPackage[] {
	return [...workPackages].sort(scheduledPositionComparator);
}

/**
 * Group work packages by their assigned team
 * Returns a map of teamId -> work packages, plus an array of unassigned work packages
 */
export function groupWorkPackagesByTeam(workPackages: WorkPackage[]): {
	byTeam: Map<TeamId, WorkPackage[]>;
	unassigned: WorkPackage[];
} {
	const byTeam = new Map<TeamId, WorkPackage[]>();
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

	// Use CapacityCalendar for month-by-month simulation
	const calendar = new CapacityCalendar(team, startDate);
	const { months, completionDate } = calendar.countMonthsForWork(remainingWorkMonths);

	return {
		teamId: team.id,
		totalWorkMonths,
		remainingWorkMonths,
		monthsToComplete: months,
		estimatedCompletionDate: completionDate,
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
	const calendar = new CapacityCalendar(team, startDate);

	for (const wp of sorted) {
		const remainingWork = getRemainingWork(wp);
		if (remainingWork <= 0) continue;

		// Capture start date before consuming work
		const wpStartDate = calendar.toDate();

		// Consume the work
		const { consumed, endDate } = calendar.consumeWork(remainingWork);

		// Only add if we could complete the work
		if (consumed >= remainingWork - 1e-9) {
			schedule.push({
				workPackage: wp,
				startDate: wpStartDate,
				endDate: endDate,
			});
		}
	}

	return schedule;
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
