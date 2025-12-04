import type { Team, WorkPackage, MonthlyCapacity } from '$lib/types';

/**
 * Creates a mock team for testing
 */
export function createMockTeam(overrides?: Partial<Team>): Team {
	return {
		id: crypto.randomUUID(),
		name: 'Test Team',
		monthlyCapacityInPersonMonths: 2.0,
		capacityOverrides: [],
		...overrides,
	};
}

/**
 * Creates a mock work package for testing
 */
export function createMockWorkPackage(overrides?: Partial<WorkPackage>): WorkPackage {
	return {
		id: crypto.randomUUID(),
		title: 'Test Work Package',
		sizeInPersonMonths: 1.0,
		priority: 0,
		progressPercent: 0,
		assignedTeamId: undefined,
		...overrides,
	};
}

/**
 * Creates a mock monthly capacity override for testing
 */
export function createMockCapacityOverride(
	overrides?: Partial<MonthlyCapacity>
): MonthlyCapacity {
	const date = new Date();
	const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

	return {
		yearMonth,
		capacity: 3.0,
		...overrides,
	};
}

/**
 * Creates multiple mock work packages with sequential priorities
 */
export function createMockWorkPackages(count: number): WorkPackage[] {
	return Array.from({ length: count }, (_, i) =>
		createMockWorkPackage({
			title: `Work Package ${i + 1}`,
			priority: i,
			sizeInPersonMonths: 1.0 + i * 0.5,
		})
	);
}

/**
 * Creates a team with capacity overrides
 */
export function createMockTeamWithOverrides(
	overrides: MonthlyCapacity[]
): Team {
	return createMockTeam({
		capacityOverrides: overrides,
	});
}
