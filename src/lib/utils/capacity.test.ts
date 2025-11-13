import { describe, it, expect, vi } from 'vitest';
import {
	getCapacityForMonth,
	calculateTotalWorkMonths,
	formatYearMonth,
	simulateWorkCompletion,
	calculateTeamBacklog,
	formatMonths,
	formatDate,
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

	describe('formatYearMonth', () => {
		it('should format date as YYYY-MM', () => {
			const date = new Date('2025-01-15');
			const result = formatYearMonth(date);
			expect(result).toBe('2025-01');
		});

		it('should pad single-digit months with zero', () => {
			const date = new Date('2025-03-01');
			const result = formatYearMonth(date);
			expect(result).toBe('2025-03');
		});

		it('should handle December correctly', () => {
			const date = new Date('2025-12-31');
			const result = formatYearMonth(date);
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
});
