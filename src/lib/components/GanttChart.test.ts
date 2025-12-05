import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import GanttChart from './GanttChart.svelte';
import { createAppStore, createDerivedStores } from '$lib/stores/appState';
import type { AppState } from '$lib/types';

describe('GanttChart', () => {
	let initialState: AppState;

	beforeEach(() => {
		// Mock the current date to ensure consistent test results
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-01-15'));

		// Reset initial state
		initialState = {
			teams: [],
			workPackages: []
		};
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function renderGanttChart(state: AppState = initialState) {
		const appState = createAppStore(state);
		const { teams } = createDerivedStores(appState);
		return render(GanttChart, {
			context: new Map<string, unknown>([
				['appState', appState],
				['teams', teams]
			])
		});
	}

	describe('empty state', () => {
		it('should show empty message when no teams exist', () => {
			renderGanttChart();

			expect(screen.getByText('No scheduled work packages to display.')).toBeInTheDocument();
			expect(screen.getByText('Assign work packages to teams in the Board view.')).toBeInTheDocument();
		});

		it('should show empty message when teams have no work packages', () => {
			renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: []
			});

			expect(screen.getByText('No scheduled work packages to display.')).toBeInTheDocument();
		});

		it('should show empty message when all work packages are unassigned', () => {
			renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Unassigned Work',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: undefined,
						scheduledPosition: 0
					}
				]
			});

			expect(screen.getByText('No scheduled work packages to display.')).toBeInTheDocument();
		});
	});

	describe('timeline header', () => {
		it('should render timeline header with months', () => {
			renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			});

			// Should show at least MIN_TIMELINE_MONTHS (6) months
			expect(screen.getByText(/Jan 2025/)).toBeInTheDocument();
			expect(screen.getByText(/Feb 2025/)).toBeInTheDocument();
			expect(screen.getByText(/Mar 2025/)).toBeInTheDocument();
		});

		it('should highlight current month in header', () => {
			const { container } = renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			});

			// Current month should have special styling
			const currentMonthHeader = container.querySelector('.bg-blue-50.text-blue-700');
			expect(currentMonthHeader).toBeInTheDocument();
			expect(currentMonthHeader?.textContent).toMatch(/Jan 2025/);
		});
	});

	describe('team rows', () => {
		it('should render team name and work package count', () => {
			renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Platform Team',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					},
					{
						id: 'wp-2',
						title: 'Feature B',
						sizeInPersonMonths: 3,
						priority: 1,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 1
					}
				]
			});

			// Team name appears in row header and legend
			const teamNames = screen.getAllByText('Platform Team');
			expect(teamNames.length).toBeGreaterThanOrEqual(1);
			expect(screen.getByText('(2 work packages)')).toBeInTheDocument();
		});

		it('should use singular form for single work package', () => {
			renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Platform Team',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			});

			expect(screen.getByText('(1 work package)')).toBeInTheDocument();
		});

		it('should render multiple teams', () => {
			renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Platform Team',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					},
					{
						id: 'team-2',
						name: 'Mobile Team',
						monthlyCapacityInPersonMonths: 3,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					},
					{
						id: 'wp-2',
						title: 'Feature B',
						sizeInPersonMonths: 3,
						priority: 1,
						progressPercent: 0,
						assignedTeamId: 'team-2',
						scheduledPosition: 0
					}
				]
			});

			// Team names appear in row headers and legend
			const platformTeamNames = screen.getAllByText('Platform Team');
			const mobileTeamNames = screen.getAllByText('Mobile Team');
			expect(platformTeamNames.length).toBeGreaterThanOrEqual(1);
			expect(mobileTeamNames.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('work package bars', () => {
		it('should render work package title in sidebar', () => {
			renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Authentication System',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			});

			// Work package title should appear in the sidebar
			const titles = screen.getAllByText('Authentication System');
			expect(titles.length).toBeGreaterThan(0);
		});

		it('should render gantt bar for work package', () => {
			const { container } = renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature Work',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			});

			// Should have a gantt bar with position styling
			const ganttBar = container.querySelector('.absolute.bg-blue-500');
			expect(ganttBar).toBeInTheDocument();
		});

		it('should schedule work packages sequentially', () => {
			const { container } = renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 1,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'First Task',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					},
					{
						id: 'wp-2',
						title: 'Second Task',
						sizeInPersonMonths: 1,
						priority: 1,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 1
					}
				]
			});

			// Should have two gantt bars
			const ganttBars = container.querySelectorAll('.absolute.bg-blue-500');
			expect(ganttBars.length).toBe(2);

			// First task: 2 PM at 1 PM/month = Jan-Feb (2 months)
			// Second task: 1 PM at 1 PM/month = Mar (1 month)
			// Both bars should have different positions
			const firstBar = ganttBars[0];
			const secondBar = ganttBars[1];
			expect(firstBar?.getAttribute('style')).not.toBe(secondBar?.getAttribute('style'));
		});
	});

	describe('dynamic timeline', () => {
			it('should extend timeline to accommodate long schedules', () => {
				renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 1,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Long Project',
						sizeInPersonMonths: 12,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			});

			// With 1 PM/month capacity and 12 PM work, should show Jan 2025 - Dec 2025
			// This is more than the MIN_TIMELINE_MONTHS (6)
			expect(screen.getByText(/Dec 2025/)).toBeInTheDocument();
		});

		it('should show minimum 6 months even with small work packages', () => {
			renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 10,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Quick Task',
						sizeInPersonMonths: 0.5,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			});

			// Should still show 6 months minimum
			expect(screen.getByText(/Jun 2025/)).toBeInTheDocument();
		});
	});

	describe('legend', () => {
		it('should show current month indicator in legend', () => {
			renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			});

			expect(screen.getByText('Current month')).toBeInTheDocument();
		});

		it('should show team colors in legend', () => {
			renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Platform Team',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					},
					{
						id: 'team-2',
						name: 'Mobile Team',
						monthlyCapacityInPersonMonths: 3,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					},
					{
						id: 'wp-2',
						title: 'Feature B',
						sizeInPersonMonths: 3,
						priority: 1,
						progressPercent: 0,
						assignedTeamId: 'team-2',
						scheduledPosition: 0
					}
				]
			});

			// Legend should show team names (twice - once in row, once in legend)
			const platformTeamElements = screen.getAllByText('Platform Team');
			const mobileTeamElements = screen.getAllByText('Mobile Team');
			expect(platformTeamElements.length).toBeGreaterThanOrEqual(2);
			expect(mobileTeamElements.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('progress handling', () => {
		it('should skip completed work packages', () => {
			const { container } = renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Completed Task',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 100,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			});

			// Completed work package should not show a gantt bar
			const ganttBars = container.querySelectorAll('.absolute.bg-blue-500');
			expect(ganttBars.length).toBe(0);
		});

		it('should schedule based on remaining work', () => {
			const { container } = renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Engineering',
						monthlyCapacityInPersonMonths: 1,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Partial Progress',
						sizeInPersonMonths: 4,
						priority: 0,
						progressPercent: 50, // 2 PM remaining
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			});

			// Should have a gantt bar
			const ganttBar = container.querySelector('.absolute.bg-blue-500');
			expect(ganttBar).toBeInTheDocument();

			// 2 PM remaining at 1 PM/month = 2 months (Jan-Feb)
			// Bar should span 2 months worth of the timeline
		});
	});

	describe('team colors', () => {
		it('should assign different colors to different teams', () => {
			const { container } = renderGanttChart({
				teams: [
					{
						id: 'team-1',
						name: 'Team A',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					},
					{
						id: 'team-2',
						name: 'Team B',
						monthlyCapacityInPersonMonths: 5,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Task A',
						sizeInPersonMonths: 1,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					},
					{
						id: 'wp-2',
						title: 'Task B',
						sizeInPersonMonths: 1,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'team-2',
						scheduledPosition: 0
					}
				]
			});

			// Should have blue bar for first team
			const blueBar = container.querySelector('.absolute.bg-blue-500');
			expect(blueBar).toBeInTheDocument();

			// Should have green bar for second team
			const greenBar = container.querySelector('.absolute.bg-green-500');
			expect(greenBar).toBeInTheDocument();
		});
	});
});
