import { describe, it, expect, vi } from 'vitest';
import {
	getCapacityForMonth,
	calculateTotalWorkMonths,
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
import { CapacityCalendar } from './CapacityCalendar';
import { YearMonth } from '$lib/types';
import { createMockTeam, createMockWorkPackage, testTeamId, testWorkPackageId } from '../../test/utils/test-data';

/** Helper to get YYYY-MM string from a Date */
const ym = (date: Date) => YearMonth.fromDate(date).toString();

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
			const result = calculateTotalWorkMonths(testTeamId('team-1'), []);
			expect(result).toBe(0);
		});

		it('should sum work packages for a specific team', () => {
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: testTeamId('team-1'), sizeInPersonMonths: 1.5 }),
				createMockWorkPackage({ assignedTeamId: testTeamId('team-1'), sizeInPersonMonths: 2.0 }),
				createMockWorkPackage({ assignedTeamId: testTeamId('team-2'), sizeInPersonMonths: 3.0 }),
			];
			const result = calculateTotalWorkMonths(testTeamId('team-1'), workPackages);
			expect(result).toBe(3.5);
		});

		it('should return 0 when no work packages match team ID', () => {
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: testTeamId('team-2'), sizeInPersonMonths: 2.0 }),
			];
			const result = calculateTotalWorkMonths(testTeamId('team-1'), workPackages);
			expect(result).toBe(0);
		});
	});

	describe('YearMonth.fromDate', () => {
		it('should format date as YYYY-MM', () => {
			const date = new Date('2025-01-15');
			const result = YearMonth.fromDate(date).toString();
			expect(result).toBe('2025-01');
		});

		it('should pad single-digit months with zero', () => {
			const date = new Date('2025-03-01');
			const result = YearMonth.fromDate(date).toString();
			expect(result).toBe('2025-03');
		});

		it('should handle December correctly', () => {
			const date = new Date('2025-12-31');
			const result = YearMonth.fromDate(date).toString();
			expect(result).toBe('2025-12');
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
				id: testTeamId('team-1'),
				monthlyCapacityInPersonMonths: 2.0,
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: testTeamId('team-1'), sizeInPersonMonths: 3.0 }),
				createMockWorkPackage({ assignedTeamId: testTeamId('team-1'), sizeInPersonMonths: 1.0 }),
			];
			const result = calculateTeamBacklog(team, workPackages);
			expect(result.totalWorkMonths).toBe(4.0);
			expect(result.monthsToComplete).toBe(2.0); // 4 PM / 2 PM per month
			expect(result.estimatedCompletionDate).not.toBeNull();
		});

		it('should only count work assigned to the team', () => {
			const team = createMockTeam({
				id: testTeamId('team-1'),
				monthlyCapacityInPersonMonths: 2.0,
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: testTeamId('team-1'), sizeInPersonMonths: 2.0 }),
				createMockWorkPackage({ assignedTeamId: testTeamId('team-2'), sizeInPersonMonths: 5.0 }),
			];
			const result = calculateTeamBacklog(team, workPackages);
			expect(result.totalWorkMonths).toBe(2.0);
		});

		it('should return Infinity for team with zero capacity', () => {
			const team = createMockTeam({
				id: testTeamId('team-1'),
				monthlyCapacityInPersonMonths: 0,
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: testTeamId('team-1'), sizeInPersonMonths: 2.0 }),
			];
			const result = calculateTeamBacklog(team, workPackages);
			expect(result.monthsToComplete).toBe(Infinity);
			expect(result.estimatedCompletionDate).toBeNull();
		});

		it('should have consistent monthsToComplete and completionDate', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2025-01-15'));

			const team = createMockTeam({
				id: testTeamId('team-1'),
				monthlyCapacityInPersonMonths: 2.0,
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: testTeamId('team-1'), sizeInPersonMonths: 4.0 }),
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
				id: testTeamId('team-1'),
				monthlyCapacityInPersonMonths: 2.0,
				capacityOverrides: [
					{ yearMonth: '2025-01', capacity: 1.0 }, // Jan: 1 PM
					{ yearMonth: '2025-02', capacity: 0 }, // Feb: 0 PM (skip)
					{ yearMonth: '2025-03', capacity: 2.0 }, // Mar: 2 PM
				],
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: testTeamId('team-1'), sizeInPersonMonths: 3.0 }),
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
				id: testTeamId('team-1'),
				monthlyCapacityInPersonMonths: 2.0,
			});
			const workPackages = [
				createMockWorkPackage({ assignedTeamId: testTeamId('team-1'), sizeInPersonMonths: 2.0 }),
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
				createMockWorkPackage({ id: testWorkPackageId('a'), priority: 0, scheduledPosition: 2 }),
				createMockWorkPackage({ id: testWorkPackageId('b'), priority: 1, scheduledPosition: 0 }),
				createMockWorkPackage({ id: testWorkPackageId('c'), priority: 2, scheduledPosition: 1 }),
			];
			const result = sortByScheduledPosition(workPackages);
			expect(result.map((wp) => wp.id)).toEqual(['b', 'c', 'a']);
		});

		it('should fall back to priority when scheduledPosition is undefined', () => {
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('a'), priority: 2 }),
				createMockWorkPackage({ id: testWorkPackageId('b'), priority: 0 }),
				createMockWorkPackage({ id: testWorkPackageId('c'), priority: 1 }),
			];
			const result = sortByScheduledPosition(workPackages);
			expect(result.map((wp) => wp.id)).toEqual(['b', 'c', 'a']);
		});

		it('should handle mixed scheduledPosition and priority', () => {
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('a'), priority: 5 }), // No position, uses priority 5
				createMockWorkPackage({ id: testWorkPackageId('b'), priority: 0, scheduledPosition: 1 }), // Position 1
				createMockWorkPackage({ id: testWorkPackageId('c'), priority: 10, scheduledPosition: 0 }), // Position 0
			];
			const result = sortByScheduledPosition(workPackages);
			expect(result.map((wp) => wp.id)).toEqual(['c', 'b', 'a']);
		});

		it('should not mutate the original array', () => {
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('a'), priority: 1 }),
				createMockWorkPackage({ id: testWorkPackageId('b'), priority: 0 }),
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
				createMockWorkPackage({ id: testWorkPackageId('a'), assignedTeamId: testTeamId('team-1') }),
				createMockWorkPackage({ id: testWorkPackageId('b'), assignedTeamId: testTeamId('team-2') }),
				createMockWorkPackage({ id: testWorkPackageId('c'), assignedTeamId: testTeamId('team-1') }),
			];
			const result = groupWorkPackagesByTeam(workPackages);

			expect(result.byTeam.get(testTeamId('team-1'))?.map((wp) => wp.id)).toEqual(['a', 'c']);
			expect(result.byTeam.get(testTeamId('team-2'))?.map((wp) => wp.id)).toEqual(['b']);
			expect(result.unassigned).toEqual([]);
		});

		it('should separate unassigned work packages', () => {
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('a'), assignedTeamId: testTeamId('team-1') }),
				createMockWorkPackage({ id: testWorkPackageId('b'), assignedTeamId: null }),
				createMockWorkPackage({ id: testWorkPackageId('c') }), // No assignedTeamId
			];
			const result = groupWorkPackagesByTeam(workPackages);

			expect(result.byTeam.get(testTeamId('team-1'))?.map((wp) => wp.id)).toEqual(['a']);
			expect(result.unassigned.map((wp) => wp.id)).toEqual(['b', 'c']);
		});

		it('should handle all unassigned', () => {
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('a') }),
				createMockWorkPackage({ id: testWorkPackageId('b') }),
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
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 3 }),
			];
			const startDate = new Date(2025, 0, 15); // Jan 15, 2025
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			expect(result[0].workPackage.id).toBe('wp-1');
			expect(ym(result[0].startDate)).toBe('2025-01');
			// 3 PM at 2 PM/month = completes in Feb (Jan: 2, Feb: 1)
			expect(ym(result[0].endDate)).toBe('2025-02');
		});

		it('should schedule work packages sequentially', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 1 });
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 2, scheduledPosition: 0 }),
				createMockWorkPackage({ id: testWorkPackageId('wp-2'), sizeInPersonMonths: 1, scheduledPosition: 1 }),
			];
			const startDate = new Date(2025, 0, 1); // Jan 1, 2025
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(2);
			// First WP: Jan-Feb (2 months at 1 PM/month)
			expect(result[0].workPackage.id).toBe('wp-1');
			expect(ym(result[0].startDate)).toBe('2025-01');
			expect(ym(result[0].endDate)).toBe('2025-02');
			// WP-2 starts where WP-1 ended (Feb) and finishes in Mar
			expect(result[1].workPackage.id).toBe('wp-2');
			expect(ym(result[1].startDate)).toBe('2025-02');
			expect(ym(result[1].endDate)).toBe('2025-03');
		});

		it('should carry over fractional capacity', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 1, scheduledPosition: 0 }),
				createMockWorkPackage({ id: testWorkPackageId('wp-2'), sizeInPersonMonths: 1.5, scheduledPosition: 1 }),
			];
			const startDate = new Date(2025, 0, 1); // Jan 1, 2025
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(2);
			// First WP: 1 PM in Jan (uses half of Jan's capacity)
			expect(ym(result[0].startDate)).toBe('2025-01');
			expect(ym(result[0].endDate)).toBe('2025-01');
			// Second WP: 1 PM leftover in Jan + needs 0.5 more in Feb
			expect(ym(result[1].startDate)).toBe('2025-01');
			expect(ym(result[1].endDate)).toBe('2025-02');
		});

		it('should skip completed work packages', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 2, progressPercent: 100, scheduledPosition: 0 }),
				createMockWorkPackage({ id: testWorkPackageId('wp-2'), sizeInPersonMonths: 1, progressPercent: 0, scheduledPosition: 1 }),
			];
			const startDate = new Date(2025, 0, 1);
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			expect(result[0].workPackage.id).toBe('wp-2');
		});

		it('should schedule based on remaining work', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 1 });
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 4, progressPercent: 50 }),
			];
			const startDate = new Date(2025, 0, 1);
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			// 2 PM remaining at 1 PM/month = 2 months
			expect(ym(result[0].startDate)).toBe('2025-01');
			expect(ym(result[0].endDate)).toBe('2025-02');
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
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 4 }),
			];
			const startDate = new Date(2025, 0, 1);
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			// 4 PM: 1 in Jan + 3 in Feb = completes in Feb
			expect(ym(result[0].startDate)).toBe('2025-01');
			expect(ym(result[0].endDate)).toBe('2025-02');
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
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 3 }),
			];
			const startDate = new Date(2025, 0, 1);
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			// 3 PM: 1 in Jan, skip Feb, 2 in Mar = completes in Mar
			expect(ym(result[0].startDate)).toBe('2025-01');
			expect(ym(result[0].endDate)).toBe('2025-03');
		});

		it('should sort by scheduledPosition before scheduling', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 1 });
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('wp-second'), sizeInPersonMonths: 1, scheduledPosition: 1 }),
				createMockWorkPackage({ id: testWorkPackageId('wp-first'), sizeInPersonMonths: 1, scheduledPosition: 0 }),
			];
			const startDate = new Date(2025, 0, 1);
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(2);
			expect(result[0].workPackage.id).toBe('wp-first');
			expect(result[1].workPackage.id).toBe('wp-second');
		});

		it('should handle work spanning multiple months', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 1 });
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 5 }),
			];
			const startDate = new Date(2025, 0, 1);
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			expect(ym(result[0].startDate)).toBe('2025-01');
			expect(ym(result[0].endDate)).toBe('2025-05');
		});

		it('should handle year boundary correctly', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 1 });
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 3 }),
			];
			const startDate = new Date(2025, 10, 1); // Nov 1, 2025
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			expect(ym(result[0].startDate)).toBe('2025-11');
			expect(ym(result[0].endDate)).toBe('2026-01');
		});

		it('should handle work that finishes exactly on month boundary', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 2, scheduledPosition: 0 }),
				createMockWorkPackage({ id: testWorkPackageId('wp-2'), sizeInPersonMonths: 1, scheduledPosition: 1 }),
			];
			const startDate = new Date(2025, 0, 1);
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(2);
			// First WP uses exactly Jan's capacity (2 PM)
			expect(ym(result[0].startDate)).toBe('2025-01');
			expect(ym(result[0].endDate)).toBe('2025-01');
			// WP-2 starts where WP-1 ended (end of Jan) and finishes in Feb
			expect(ym(result[1].startDate)).toBe('2025-01');
			expect(ym(result[1].endDate)).toBe('2025-02');
		});

		it('should handle fractional work spanning months', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 2.5 }),
			];
			const startDate = new Date(2025, 0, 1);
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(1);
			// 2.5 PM: 2 in Jan, 0.5 in Feb = completes in Feb
			expect(ym(result[0].startDate)).toBe('2025-01');
			expect(ym(result[0].endDate)).toBe('2025-02');
		});

		it('should carry leftover capacity to next work package', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 3 });
			const workPackages = [
				createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 1, scheduledPosition: 0 }),
				createMockWorkPackage({ id: testWorkPackageId('wp-2'), sizeInPersonMonths: 1, scheduledPosition: 1 }),
				createMockWorkPackage({ id: testWorkPackageId('wp-3'), sizeInPersonMonths: 1, scheduledPosition: 2 }),
			];
			const startDate = new Date(2025, 0, 1);
			const result = calculateTeamSchedule(team, workPackages, startDate);

			expect(result).toHaveLength(3);
			// All 3 WPs fit in January (3 PM capacity)
			expect(ym(result[0].startDate)).toBe('2025-01');
			expect(ym(result[0].endDate)).toBe('2025-01');
			expect(ym(result[1].startDate)).toBe('2025-01');
			expect(ym(result[1].endDate)).toBe('2025-01');
			expect(ym(result[2].startDate)).toBe('2025-01');
			expect(ym(result[2].endDate)).toBe('2025-01');
		});
	});

	describe('precise date calculations', () => {
		describe('capacity calendar - day precision', () => {
			it('should return precise day when work completes mid-month', () => {
				const team = createMockTeam({ monthlyCapacityInPersonMonths: 2.0 });
				const startDate = new Date(2025, 0, 1); // Jan 1, 2025
				// 3 PM work: 2 PM in Jan, 1 PM in Feb
				// 1 PM / 2 PM = 50% of February
				// February 2025 has 28 days, 50% = day 14
				const calendar = new CapacityCalendar(team, startDate);
				const { completionDate } = calendar.countMonthsForWork(3.0);
				expect(completionDate).not.toBeNull();
				expect(completionDate!.getFullYear()).toBe(2025);
				expect(completionDate!.getMonth()).toBe(1); // February
				expect(completionDate!.getDate()).toBe(14); // Mid-month
			});

			it('should return last day when work completes exactly at month boundary', () => {
				const team = createMockTeam({ monthlyCapacityInPersonMonths: 2.0 });
				const startDate = new Date(2025, 0, 1); // Jan 1, 2025
				// 2 PM work: exactly 2 PM in Jan = completes end of Jan
				const calendar = new CapacityCalendar(team, startDate);
				const { completionDate } = calendar.countMonthsForWork(2.0);
				expect(completionDate).not.toBeNull();
				expect(completionDate!.getFullYear()).toBe(2025);
				expect(completionDate!.getMonth()).toBe(0); // January
				expect(completionDate!.getDate()).toBe(31); // Last day of January
			});

			it('should handle variable month lengths', () => {
				const team = createMockTeam({ monthlyCapacityInPersonMonths: 1.0 });
				const startDate = new Date(2025, 2, 1); // Mar 1, 2025 (31 days)
				// 0.5 PM work at 1 PM/month = 50% of March
				const calendar = new CapacityCalendar(team, startDate);
				const { completionDate } = calendar.countMonthsForWork(0.5);
				expect(completionDate).not.toBeNull();
				expect(completionDate!.getMonth()).toBe(2); // March
				// 50% of 31 days = ~15-16
				expect(completionDate!.getDate()).toBeGreaterThanOrEqual(15);
				expect(completionDate!.getDate()).toBeLessThanOrEqual(16);
			});
		});

		describe('calculateTeamSchedule - precise dates', () => {
			it('should return startDate and endDate as Date objects', () => {
				const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
				const workPackages = [
					createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 3 }),
				];
				const startDate = new Date(2025, 0, 1);
				const result = calculateTeamSchedule(team, workPackages, startDate);

				expect(result).toHaveLength(1);
				expect(result[0].startDate).toBeInstanceOf(Date);
				expect(result[0].endDate).toBeInstanceOf(Date);
			});

			it('should calculate precise start and end dates', () => {
				const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
				const workPackages = [
					createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 3, scheduledPosition: 0 }),
				];
				const startDate = new Date(2025, 0, 1);
				const result = calculateTeamSchedule(team, workPackages, startDate);

				// 3 PM at 2 PM/month: 2 PM in Jan, 1 PM in Feb
				// Starts: Jan 1
				// Ends: Feb 14 (50% through Feb's 28 days)
				expect(result[0].startDate.getMonth()).toBe(0); // January
				expect(result[0].startDate.getDate()).toBe(1);
				expect(result[0].endDate.getMonth()).toBe(1); // February
				expect(result[0].endDate.getDate()).toBe(14);
			});

			it('should chain work packages with precise dates', () => {
				const team = createMockTeam({ monthlyCapacityInPersonMonths: 2 });
				const workPackages = [
					createMockWorkPackage({ id: testWorkPackageId('wp-1'), sizeInPersonMonths: 1, scheduledPosition: 0 }),
					createMockWorkPackage({ id: testWorkPackageId('wp-2'), sizeInPersonMonths: 1, scheduledPosition: 1 }),
				];
				const startDate = new Date(2025, 0, 1);
				const result = calculateTeamSchedule(team, workPackages, startDate);

				expect(result).toHaveLength(2);
				// WP-1: 1 PM at 2 PM/month = 50% of Jan = ends around Jan 15-16
				expect(result[0].startDate.getDate()).toBe(1);
				expect(result[0].endDate.getDate()).toBeGreaterThanOrEqual(15);
				expect(result[0].endDate.getDate()).toBeLessThanOrEqual(16);

				// WP-2 should start exactly where WP-1 ended
				expect(result[1].startDate.getTime()).toBe(result[0].endDate.getTime());
			});
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
