import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from '../../routes/+page.svelte';
import type { PlanningPageData, Team, WorkPackage } from '$lib/types';

// Mock the $app/stores module
vi.mock('$app/stores', () => ({
	page: {
		subscribe: vi.fn((callback) => {
			callback({ form: null });
			return () => {};
		})
	}
}));

// Mock the $app/forms module
vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => {
		return () => {};
	})
}));

// Mock optimistikit
vi.mock('optimistikit', () => ({
	optimistikit: vi.fn((dataFn) => {
		return {
			data: dataFn(),
			enhance: vi.fn(() => {
				return () => {};
			})
		};
	})
}));

function normalizePageData(data: PlanningPageData) {
	return {
		initialState: {
			teams: data.initialState.teams.map((team) => ({
				...team,
				capacityOverrides: team.capacityOverrides ?? []
			})),
			workPackages: data.initialState.workPackages.map((workPackage) => ({
				...workPackage,
				description: workPackage.description ?? undefined,
				assignedTeamId: workPackage.assignedTeamId ?? undefined,
				scheduledPosition: workPackage.scheduledPosition ?? undefined
			}))
		}
	};
}

function renderPage(data: PlanningPageData) {
	return render(Page, { props: { data: normalizePageData(data) } });
}

describe('Page Component - Initial Render', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render teams from props immediately without "No teams" message', () => {
		const teams: Team[] = [
			{
				id: 'team-1',
				name: 'Engineering Team',
				monthlyCapacityInPersonMonths: 5.0,
				capacityOverrides: []
			},
			{
				id: 'team-2',
				name: 'Design Team',
				monthlyCapacityInPersonMonths: 3.0,
				capacityOverrides: []
			}
		];

		const testData: PlanningPageData = {
			initialState: {
				teams,
				workPackages: []
			}
		};

		renderPage(testData);

		// Verify teams are rendered
		expect(screen.getByText('Engineering Team')).toBeInTheDocument();
		expect(screen.getByText('Design Team')).toBeInTheDocument();

		// Verify no "No teams" message appears
		expect(screen.queryByText(/no teams/i)).not.toBeInTheDocument();
	});

	it('should render work packages from props immediately without "No work packages" message', () => {
		const workPackages: WorkPackage[] = [
			{
				id: 'wp-1',
				title: 'Build Authentication',
				description: 'Implement user login',
				sizeInPersonMonths: 2.5,
				priority: 0,
				progressPercent: 0
			},
			{
				id: 'wp-2',
				title: 'Design Dashboard',
				sizeInPersonMonths: 1.5,
				priority: 1,
				progressPercent: 0
			}
		];

		const testData: PlanningPageData = {
			initialState: {
				teams: [],
				workPackages
			}
		};

		renderPage(testData);

		// Verify work packages are rendered
		expect(screen.getByText('Build Authentication')).toBeInTheDocument();
		expect(screen.getByText('Design Dashboard')).toBeInTheDocument();

		// Verify no "No work packages" message appears
		expect(screen.queryByText(/no work packages/i)).not.toBeInTheDocument();
	});

	it('should render both teams and work packages from props immediately', () => {
		const teams: Team[] = [
			{
				id: 'team-1',
				name: 'Engineering Team',
				monthlyCapacityInPersonMonths: 5.0,
				capacityOverrides: []
			}
		];

		const workPackages: WorkPackage[] = [
			{
				id: 'wp-1',
				title: 'Build Authentication',
				sizeInPersonMonths: 2.5,
				priority: 0,
				progressPercent: 0,
				assignedTeamId: 'team-1',
				scheduledPosition: 0
			}
		];

		const testData: PlanningPageData = {
			initialState: {
				teams,
				workPackages
			}
		};

		renderPage(testData);

		// Verify both teams and work packages are rendered
		expect(screen.getByText('Engineering Team')).toBeInTheDocument();
		expect(screen.getByText('Build Authentication')).toBeInTheDocument();

		// Verify no empty state messages appear
		expect(screen.queryByText(/no teams/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/no work packages/i)).not.toBeInTheDocument();
	});

	it('should render assigned work packages under their team columns', () => {
		const teams: Team[] = [
			{
				id: 'team-1',
				name: 'Engineering Team',
				monthlyCapacityInPersonMonths: 5.0,
				capacityOverrides: []
			}
		];

		const workPackages: WorkPackage[] = [
			{
				id: 'wp-1',
				title: 'Assigned Work Package',
				sizeInPersonMonths: 2.5,
				priority: 0,
				progressPercent: 0,
				assignedTeamId: 'team-1',
				scheduledPosition: 0
			},
			{
				id: 'wp-2',
				title: 'Unassigned Work Package',
				sizeInPersonMonths: 1.5,
				priority: 1,
				progressPercent: 0
			}
		];

		const testData: PlanningPageData = {
			initialState: {
				teams,
				workPackages
			}
		};

		renderPage(testData);

		// Verify both work packages are rendered
		expect(screen.getByText('Assigned Work Package')).toBeInTheDocument();
		expect(screen.getByText('Unassigned Work Package')).toBeInTheDocument();

		// Verify team is rendered
		expect(screen.getByText('Engineering Team')).toBeInTheDocument();
	});

	it('should render page with empty state (no teams or work packages)', () => {
		const testData: PlanningPageData = {
			initialState: {
				teams: [],
				workPackages: []
			}
		};

		renderPage(testData);

		// Verify page renders without errors
		expect(screen.getByText('Capacity Planning')).toBeInTheDocument();
		expect(screen.getByText('Board')).toBeInTheDocument();
		expect(screen.getByText('Work Packages')).toBeInTheDocument();
		expect(screen.getByText('Teams')).toBeInTheDocument();
	});
});
