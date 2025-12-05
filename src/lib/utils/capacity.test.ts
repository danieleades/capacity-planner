import { describe, it, expect, vi } from 'vitest';
import {
	getCapacityForMonth,
	calculateTotalWorkMonths,
	toYearMonth,
	simulateWorkCompletion,
	calculateTeamBacklog,
	formatMonths,
	formatDate,
	sortByScheduledPosition,
	groupWorkPackagesByTeam,
	calculateTeamSchedule,
	getRemainingWork,
	calculateCardHeight,
	CARD_HEIGHT_CONFIG,
} from './capacity';
import { createMockTeam, createMockWorkPackage } from '../../test/utils/test-data';

describe('capacity utilities', () => {
	describe('getCapacityForMonth', () => {
		it('should return default capacity when no override exists', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2.5 });
			const result = getCapacityForMonth(team, '2025-01');
			expect(result).toBe(2.5);
		});

		it('should return override capacity when one exists', () => {
			const team = createMockTeam({
				monthlyCapacityInPersonMonths: 2.5,
				capacityOverrides: [{ yearMonth: '2025-01', capacity: 3.0 }],
			});
			const result = getCapacityForMonth(team, '2025-01');
			expect(result).toBe(3.0);
		});

		it('should return default capacity for months without overrides', () => {
			const team = createMockTeam({
				monthlyCapacityInPersonMonths: 2.5,
				capacityOverrides: [{ yearMonth: '2025-01', capacity: 3.0 }],
			});
			const result = getCapacityForMonth(team, '2025-02');
			expect(result).toBe(2.5);
		});
	});

	describe('calculateTotalWorkMonths', () => {
		it('should return 0 for empty work packages', () => {
			const result = calculateTotalWorkMonths('team-1', []);
			expect(result).toBe(0);
		});

		it('should sum work packages for a specific team', () => {
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: 'team-1', sizeInPersonMonths: 1.5 }),
				createMockWorkPackage({ assignedTeamId: 'team-1', sizeInPersonMonths: 2.0 }),
				createMockWorkPackage({ assignedTeamId: 'team-2', sizeInPersonMonths: 3.0 }),
			];
			const result = calculateTotalWorkMonths('team-1', workPackages);
			expect(result).toBe(3.5);
		});

		it('should return 0 when no work packages match team ID', () => {
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: 'team-2', sizeInPersonMonths: 2.0 }),
			];
			const result = calculateTotalWorkMonths('team-1', workPackages);
			expect(result).toBe(0);
		});
	});

	describe('toYearMonth', () => {
		it('should format date as YYYY-MM', () => {
			const date = new Date('2025-01-15');
			const result = toYearMonth(date);
			expect(result).toBe('2025-01');
		});

		it('should pad single-digit months with zero', () => {
			const date = new Date('2025-03-01');
			const result = toYearMonth(date);
			expect(result).toBe('2025-03');
		});

		it('should handle December correctly', () => {
			const date = new Date('2025-12-31');
			const result = toYearMonth(date);
			expect(result).toBe('2025-12');
		});
	});

	describe('simulateWorkCompletion', () => {
		it('should return null for zero work', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2.0 });
			const result = simulateWorkCompletion(team, 0);
			expect(result).toBeNull();
		});

		it('should return null for negative work', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2.0 });
			const result = simulateWorkCompletion(team, -5);
			expect(result).toBeNull();
		});

		it('should calculate completion date with constant capacity', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2.0 });
			const startDate = new Date('2025-01-01');
			// 4 person-months of work / 2 PM per month = completes in Feb (month 1)
			const result = simulateWorkCompletion(team, 4.0, startDate);
			expect(result).not.toBeNull();
			expect(result!.getMonth()).toBe(1); // February (final working month)
		});

		it('should calculate completion date with variable capacity', () => {
			const team = createMockTeam({
				monthlyCapacityInPersonMonths: 2.0,
				capacityOverrides: [
					{ yearMonth: '2025-01', capacity: 1.0 },
					{ yearMonth: '2025-02', capacity: 3.0 },
				],
			});
			const startDate = new Date('2025-01-01');
			// 4 PM work: 1 PM in Jan + 3 PM in Feb = completes in Feb
			const result = simulateWorkCompletion(team, 4.0, startDate);
			expect(result).not.toBeNull();
			expect(result!.getMonth()).toBe(1); // February (final working month)
		});

		it('should return null when capacity is zero', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 0 });
			const result = simulateWorkCompletion(team, 5.0);
			expect(result).toBeNull();
		});

		it('should handle partial month completion', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2.0 });
			const startDate = new Date('2025-01-01');
			// 3 PM work: 2 PM in Jan, 1 PM in Feb, completes in Feb
			const result = simulateWorkCompletion(team, 3.0, startDate);
			expect(result).not.toBeNull();
			expect(result!.getMonth()).toBe(1); // February (final working month)
		});
	});

	describe('calculateTeamBacklog', () => {
		it('should calculate metrics for team with no work', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2.0 });
			const result = calculateTeamBacklog(team, []);
			expect(result.totalWorkMonths).toBe(0);
			expect(result.monthsToComplete).toBe(0); // No work = 0 months to complete
			expect(result.estimatedCompletionDate).toBeNull();
		});

		it('should calculate metrics for team with assigned work', () => {
			const team = createMockTeam({
				id: 'team-1',
				monthlyCapacityInPersonMonths: 2.0,
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: 'team-1', sizeInPersonMonths: 3.0 }),
				createMockWorkPackage({ assignedTeamId: 'team-1', sizeInPersonMonths: 1.0 }),
			];
			const result = calculateTeamBacklog(team, workPackages);
			expect(result.totalWorkMonths).toBe(4.0);
			expect(result.monthsToComplete).toBe(2.0); // 4 PM / 2 PM per month
			expect(result.estimatedCompletionDate).not.toBeNull();
		});

		it('should only count work assigned to the team', () => {
			const team = createMockTeam({
				id: 'team-1',
				monthlyCapacityInPersonMonths: 2.0,
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: 'team-1', sizeInPersonMonths: 2.0 }),
				createMockWorkPackage({ assignedTeamId: 'team-2', sizeInPersonMonths: 5.0 }),
			];
			const result = calculateTeamBacklog(team, workPackages);
			expect(result.totalWorkMonths).toBe(2.0);
		});

		it('should return Infinity for team with zero capacity', () => {
			const team = createMockTeam({
				id: 'team-1',
				monthlyCapacityInPersonMonths: 0,
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: 'team-1', sizeInPersonMonths: 2.0 }),
			];
			const result = calculateTeamBacklog(team, workPackages);
			expect(result.monthsToComplete).toBe(Infinity);
			expect(result.estimatedCompletionDate).toBeNull();
		});

		it('should have consistent monthsToComplete and completionDate', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2025-01-15'));

			const team = createMockTeam({
				id: 'team-1',
				monthlyCapacityInPersonMonths: 2.0,
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: 'team-1', sizeInPersonMonths: 4.0 }),
			];

			const result = calculateTeamBacklog(team, workPackages);

			// Should take 2 months (4 PM / 2 PM per month)
			expect(result.monthsToComplete).toBe(2);

			// Completion date should be Feb 2025 (current month + 2 months)
			expect(result.estimatedCompletionDate).not.toBeNull();
			expect(result.estimatedCompletionDate!.getFullYear()).toBe(2025);
			expect(result.estimatedCompletionDate!.getMonth()).toBe(1); // February (0-indexed)

			vi.useRealTimers();
		});

		it('should handle variable capacity correctly', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2025-01-15'));

			const team = createMockTeam({
				id: 'team-1',
				monthlyCapacityInPersonMonths: 2.0,
				capacityOverrides: [
					{ yearMonth: '2025-01', capacity: 1.0 }, // Jan: 1 PM
					{ yearMonth: '2025-02', capacity: 0 }, // Feb: 0 PM (skip)
					{ yearMonth: '2025-03', capacity: 2.0 }, // Mar: 2 PM
				],
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: 'team-1', sizeInPersonMonths: 3.0 }),
			];

			const result = calculateTeamBacklog(team, workPackages);

			// Should consume: Jan (1 PM) + Feb (0 PM) + Mar (2 PM) = 3 PM in 2 working months
			expect(result.monthsToComplete).toBe(2); // Only months with capacity > 0
			expect(result.estimatedCompletionDate).not.toBeNull();
			expect(result.estimatedCompletionDate!.getFullYear()).toBe(2025);
			expect(result.estimatedCompletionDate!.getMonth()).toBe(2); // March (0-indexed)

			vi.useRealTimers();
		});

		it('should return completion date matching final working month', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2025-01-15'));

			const team = createMockTeam({
				id: 'team-1',
				monthlyCapacityInPersonMonths: 2.0,
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: 'team-1', sizeInPersonMonths: 2.0 }),
			];

			const result = calculateTeamBacklog(team, workPackages);

			// Should complete in Jan itself (2 PM work, 2 PM capacity)
			expect(result.monthsToComplete).toBe(1);
			expect(result.estimatedCompletionDate!.getFullYear()).toBe(2025);
			expect(result.estimatedCompletionDate!.getMonth()).toBe(0); // January

			vi.useRealTimers();
		});
	});

	describe('formatMonths', () => {
		it('should format infinity as ∞', () => {
			expect(formatMonths(Infinity)).toBe('∞');
		});

		it('should format less than 1 month as weeks', () => {
			expect(formatMonths(0.5)).toBe('2 weeks');
			expect(formatMonths(0.25)).toBe('1 weeks');
		});

		it('should format 1-11 months with decimal', () => {
			expect(formatMonths(1.5)).toBe('1.5 months');
			expect(formatMonths(6.2)).toBe('6.2 months');
			expect(formatMonths(11.9)).toBe('11.9 months');
		});

		it('should format exact years', () => {
			expect(formatMonths(12)).toBe('1 year');
			expect(formatMonths(24)).toBe('2 years');
		});

		it('should format years with remaining months', () => {
			expect(formatMonths(13)).toBe('1y 1m');
			expect(formatMonths(26)).toBe('2y 2m');
			expect(formatMonths(18.6)).toBe('1y 7m'); // Rounds to 7 months
		});
	});

	describe('formatDate', () => {
		it('should format null as "Never"', () => {
			expect(formatDate(null)).toBe('Never');
		});

		it('should format date in en-US locale', () => {
			const date = new Date('2025-01-15');
			const result = formatDate(date);
			expect(result).toMatch(/Jan.*15.*2025/);
		});

		it('should handle different months', () => {
			const date = new Date('2025-12-25');
			const result = formatDate(date);
			expect(result).toMatch(/Dec.*25.*2025/);
		});
	});

	describe('sortByScheduledPosition', () => {
		it('should sort by scheduledPosition when present', () => {
			const workPackages = [
				createMockWorkPackage({ id: 'a', priority: 0, scheduledPosition: 2 }),
				createMockWorkPackage({ id: 'b', priority: 1, scheduledPosition: 0 }),
				createMockWorkPackage({ id: 'c', priority: 2, scheduledPosition: 1 }),
			];
			const result = sortByScheduledPosition(workPackages);
			expect(result.map((wp) => wp.id)).toEqual(['b', 'c', 'a']);
		});

		it('should fall back to priority when scheduledPosition is undefined', () => {
			const workPackages = [
				createMockWorkPackage({ id: 'a', priority: 2 }),
				createMockWorkPackage({ id: 'b', priority: 0 }),
				createMockWorkPackage({ id: 'c', priority: 1 }),
			];
			const result = sortByScheduledPosition(workPackages);
			expect(result.map((wp) => wp.id)).toEqual(['b', 'c', 'a']);
		});

		it('should handle mixed scheduledPosition and priority', () => {
			const workPackages = [
				createMockWorkPackage({ id: 'a', priority: 5 }), // No position, uses priority 5
				createMockWorkPackage({ id: 'b', priority: 0, scheduledPosition: 1 }), // Position 1
				createMockWorkPackage({ id: 'c', priority: 10, scheduledPosition: 0 }), // Position 0
			];
			const result = sortByScheduledPosition(workPackages);
			expect(result.map((wp) => wp.id)).toEqual(['c', 'b', 'a']);
		});

		it('should not mutate the original array', () => {
			const workPackages = [
				createMockWorkPackage({ id: 'a', priority: 1 }),
				createMockWorkPackage({ id: 'b', priority: 0 }),
			];
			const original = [...workPackages];
			sortByScheduledPosition(workPackages);
			expect(workPackages).toEqual(original);
		});

		it('should return empty array for empty input', () => {
			expect(sortByScheduledPosition([])).toEqual([]);
		});
	});

	describe('groupWorkPackagesByTeam', () => {
		it('should group work packages by team', () => {
			const workPackages = [
				createMockWorkPackage({ id: 'a', assignedTeamId: 'team-1' }),
				createMockWorkPackage({ id: 'b', assignedTeamId: 'team-2' }),
				createMockWorkPackage({ id: 'c', assignedTeamId: 'team-1' }),
			];
			const result = groupWorkPackagesByTeam(workPackages);

			expect(result.byTeam.get('team-1')?.map((wp) => wp.id)).toEqual(['a', 'c']);
			expect(result.byTeam.get('team-2')?.map((wp) => wp.id)).toEqual(['b']);
			expect(result.unassigned).toEqual([]);
		});

		it('should separate unassigned work packages', () => {
			const workPackages = [
				createMockWorkPackage({ id: 'a', assignedTeamId: 'team-1' }),
				createMockWorkPackage({ id: 'b', assignedTeamId: undefined }),
				createMockWorkPackage({ id: 'c' }), // No assignedTeamId
			];
			const result = groupWorkPackagesByTeam(workPackages);

			expect(result.byTeam.get('team-1')?.map((wp) => wp.id)).toEqual(['a']);
			expect(result.unassigned.map((wp) => wp.id)).toEqual(['b', 'c']);
		});

		it('should handle all unassigned', () => {
			const workPackages = [
				createMockWorkPackage({ id: 'a' }),
				createMockWorkPackage({ id: 'b' }),
			];
			const result = groupWorkPackagesByTeam(workPackages);

			expect(result.byTeam.size).toBe(0);
			expect(result.unassigned.map((wp) => wp.id)).toEqual(['a', 'b']);
		});

		it('should handle empty array', () => {
			const result = groupWorkPackagesByTeam([]);
			expect(result.byTeam.size).toBe(0);
			expect(result.unassigned).toEqual([]);
		});
	});

	describe('getRemainingWork', () => {
		it('should return full size when no progress', () => {
			const wp = createMockWorkPackage({ sizeInPersonMonths: 4, progressPercent: 0 });
			expect(getRemainingWork(wp)).toBe(4);
		});

		it('should return half when 50% progress', () => {
			const wp = createMockWorkPackage({ sizeInPersonMonths: 4, progressPercent: 50 });
			expect(getRemainingWork(wp)).toBe(2);
		});

		it('should return 0 when 100% complete', () => {
			const wp = createMockWorkPackage({ sizeInPersonMonths: 4, progressPercent: 100 });
			expect(getRemainingWork(wp)).toBe(0);
		});

		it('should handle undefined progressPercent as 0', () => {
			const wp = createMockWorkPackage({ sizeInPersonMonths: 4 });
			// progressPercent should default to 0 in createMockWorkPackage
			expect(getRemainingWork(wp)).toBe(4);
		});
	});

	describe('calculateTeamSchedule', () => {
		it('should return empty array for no work packages', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
			const result = calculateTeamSchedule(team, []);
			expect(result).toEqual([]);
		});

		it('should schedule single work package', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 3 }),
			];
			const startDate = new Date('2025-01-15');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			expect(result[0].workPackage.id).toBe('wp-1');
			expect(result[0].startYearMonth).toBe('2025-01');
			// 3 PM at 2 PM/month = completes in Feb (Jan: 2, Feb: 1)
			expect(result[0].endYearMonth).toBe('2025-02');
		});

		it('should schedule work packages sequentially', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 1 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 2, scheduledPosition: 0 }),
				createMockWorkPackage({ id: 'wp-2', sizeInPersonMonths: 1, scheduledPosition: 1 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(2);
			// First WP: Jan-Feb (2 months at 1 PM/month)
			expect(result[0].workPackage.id).toBe('wp-1');
			expect(result[0].startYearMonth).toBe('2025-01');
			expect(result[0].endYearMonth).toBe('2025-02');
			// After WP-1 finishes in Feb, availableCapacity=0 but remainingWork=0
			// So we don't advance to next month. currentMonth stays at Feb.
			// WP-2: startYearMonth captured as '2025-02', then loop sees 0 capacity,
			// advances to Mar, does 1 PM work, ends in Mar
			expect(result[1].workPackage.id).toBe('wp-2');
			expect(result[1].startYearMonth).toBe('2025-02');  // Captured before skipping zero-capacity
			expect(result[1].endYearMonth).toBe('2025-03');    // Actual work done in Mar
		});

		it('should carry over fractional capacity', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 1, scheduledPosition: 0 }),
				createMockWorkPackage({ id: 'wp-2', sizeInPersonMonths: 1.5, scheduledPosition: 1 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(2);
			// First WP: 1 PM in Jan (uses half of Jan's capacity)
			expect(result[0].startYearMonth).toBe('2025-01');
			expect(result[0].endYearMonth).toBe('2025-01');
			// Second WP: 1 PM remaining in Jan + 0.5 PM in Feb... wait, only 1.5 total
			// Actually: 1 PM leftover in Jan, so wp-2 uses 1 PM in Jan + 0.5 in Feb?
			// No: 1.5 PM work, 1 PM leftover = all fits in Jan
			expect(result[1].startYearMonth).toBe('2025-01');
			expect(result[1].endYearMonth).toBe('2025-02');
		});

		it('should skip completed work packages', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 2, progressPercent: 100, scheduledPosition: 0 }),
				createMockWorkPackage({ id: 'wp-2', sizeInPersonMonths: 1, progressPercent: 0, scheduledPosition: 1 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			expect(result[0].workPackage.id).toBe('wp-2');
		});

		it('should schedule based on remaining work', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 1 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 4, progressPercent: 50 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			// 2 PM remaining at 1 PM/month = 2 months
			expect(result[0].startYearMonth).toBe('2025-01');
			expect(result[0].endYearMonth).toBe('2025-02');
		});

		it('should handle variable capacity with overrides', () => {
			const team = createMockTeam({
				monthlyCapacityInPersonMonths: 2,
				capacityOverrides: [
					{ yearMonth: '2025-01', capacity: 1 },
					{ yearMonth: '2025-02', capacity: 3 },
				],
			});
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 4 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			// 4 PM: 1 in Jan + 3 in Feb = completes in Feb
			expect(result[0].startYearMonth).toBe('2025-01');
			expect(result[0].endYearMonth).toBe('2025-02');
		});

		it('should skip months with zero capacity', () => {
			const team = createMockTeam({
				monthlyCapacityInPersonMonths: 2,
				capacityOverrides: [
					{ yearMonth: '2025-01', capacity: 1 },
					{ yearMonth: '2025-02', capacity: 0 }, // Zero capacity in Feb
				],
			});
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 3 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			// 3 PM: 1 in Jan, skip Feb, 2 in Mar = completes in Mar
			expect(result[0].startYearMonth).toBe('2025-01');
			expect(result[0].endYearMonth).toBe('2025-03');
		});

		it('should sort by scheduledPosition before scheduling', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 1 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-second', sizeInPersonMonths: 1, scheduledPosition: 1 }),
				createMockWorkPackage({ id: 'wp-first', sizeInPersonMonths: 1, scheduledPosition: 0 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(2);
			expect(result[0].workPackage.id).toBe('wp-first');
			expect(result[1].workPackage.id).toBe('wp-second');
		});

		it('should handle work spanning multiple months', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 1 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 5 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			expect(result[0].startYearMonth).toBe('2025-01');
			expect(result[0].endYearMonth).toBe('2025-05');
		});

		it('should handle year boundary correctly', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 1 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 3 }),
			];
			const startDate = new Date('2025-11-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			expect(result[0].startYearMonth).toBe('2025-11');
			expect(result[0].endYearMonth).toBe('2026-01');
		});

		it('should handle work that finishes exactly on month boundary', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 2, scheduledPosition: 0 }),
				createMockWorkPackage({ id: 'wp-2', sizeInPersonMonths: 1, scheduledPosition: 1 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(2);
			// First WP uses exactly Jan's capacity (2 PM)
			expect(result[0].startYearMonth).toBe('2025-01');
			expect(result[0].endYearMonth).toBe('2025-01');
			// After WP-1: currentMonth=Jan, availableCapacity=0, remainingWork=0
			// WP-2 starts with startYearMonth='2025-01', then loop skips to Feb (0 capacity)
			// Work is done in Feb
			expect(result[1].startYearMonth).toBe('2025-01');  // Captured before skip
			expect(result[1].endYearMonth).toBe('2025-02');    // Actual work in Feb
		});

		it('should handle fractional work spanning months', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 2.5 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			// 2.5 PM: 2 in Jan, 0.5 in Feb = completes in Feb
			expect(result[0].startYearMonth).toBe('2025-01');
			expect(result[0].endYearMonth).toBe('2025-02');
		});

		it('should carry leftover capacity to next work package', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 3 });
			const workPackages = [
				createMockWorkPackage({ id: 'wp-1', sizeInPersonMonths: 1, scheduledPosition: 0 }),
				createMockWorkPackage({ id: 'wp-2', sizeInPersonMonths: 1, scheduledPosition: 1 }),
				createMockWorkPackage({ id: 'wp-3', sizeInPersonMonths: 1, scheduledPosition: 2 }),
			];
			const startDate = new Date('2025-01-01');
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(3);
			// All 3 WPs fit in January (3 PM capacity)
			expect(result[0].startYearMonth).toBe('2025-01');
			expect(result[0].endYearMonth).toBe('2025-01');
			expect(result[1].startYearMonth).toBe('2025-01');
			expect(result[1].endYearMonth).toBe('2025-01');
			expect(result[2].startYearMonth).toBe('2025-01');
			expect(result[2].endYearMonth).toBe('2025-01');
		});
	});

	describe('calculateCardHeight', () => {
		const { minHeight, maxHeight } = CARD_HEIGHT_CONFIG;

		it('should return minHeight when globalMaxRemainingWork is 0', () => {
			expect(calculateCardHeight(5, 0)).toBe(minHeight);
		});

		it('should return minHeight when globalMaxRemainingWork is negative', () => {
			expect(calculateCardHeight(5, -1)).toBe(minHeight);
		});

		it('should return minHeight when scalingIntensity is 0', () => {
			expect(calculateCardHeight(5, 10, 0)).toBe(minHeight);
		});

		it('should return minHeight when remainingWork is 0', () => {
			expect(calculateCardHeight(0, 10)).toBe(minHeight);
		});

		it('should return maxHeight when remainingWork equals globalMax at 100% intensity', () => {
			expect(calculateCardHeight(10, 10, 100)).toBe(maxHeight);
		});

		it('should scale linearly between min and max', () => {
			// At 50% of max work, should be halfway between min and max
			const halfwayHeight = minHeight + (maxHeight - minHeight) / 2;
			expect(calculateCardHeight(5, 10, 100)).toBe(halfwayHeight);
		});

		it('should respect scaling intensity', () => {
			// At 50% intensity, effective max is halfway between min and max
			const effectiveMax = minHeight + (maxHeight - minHeight) * 0.5;
			// Full remaining work at 50% intensity
			expect(calculateCardHeight(10, 10, 50)).toBe(effectiveMax);
		});

		it('should clamp to max when remainingWork exceeds globalMax', () => {
			// If remainingWork > globalMax, should still cap at maxHeight
			expect(calculateCardHeight(20, 10, 100)).toBe(maxHeight);
		});
	});
});
