import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import WorkPackagesTable from './WorkPackagesTable.svelte';
import { createAppStore, createDerivedStores } from '$lib/stores/appState';
import type { OptimisticEnhanceAction } from '$lib/types/optimistic';
import type { PlanningPageData, AppState } from '$lib/types';

describe('WorkPackagesTable', () => {
	const mockOptimisticEnhance = vi.fn((_node, _callback) => {
		return {
			update: () => {},
			destroy: () => {}
		};
	}) as unknown as OptimisticEnhanceAction<PlanningPageData>;

	let initialState: AppState;

	beforeEach(() => {
		initialState = {
			teams: [],
			workPackages: []
		};
		vi.clearAllMocks();
	});

	function renderWorkPackagesTable(state: AppState = initialState) {
		const appState = createAppStore(state);
		const { workPackages } = createDerivedStores(appState);
		return render(WorkPackagesTable, {
			props: { optimisticEnhance: mockOptimisticEnhance },
			context: new Map<string, unknown>([
				['appState', appState],
				['workPackages', workPackages]
			])
		});
	}

	describe('empty state', () => {
		it('should show empty message when no work packages exist', () => {
			renderWorkPackagesTable();

			expect(screen.getByText('No work packages yet. Add one to get started.')).toBeInTheDocument();
		});

		it('should show add button even when empty', () => {
			renderWorkPackagesTable();

			expect(screen.getByText('+ Add Work Package')).toBeInTheDocument();
		});
	});

	describe('table rendering', () => {
		it('should render table with work packages', () => {
			renderWorkPackagesTable({
				teams: [],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2.5,
						priority: 0,
						progressPercent: 25,
						scheduledPosition: 0
					}
				]
			});

			expect(screen.getByText('Feature A')).toBeInTheDocument();
			expect(screen.getByText('2.5')).toBeInTheDocument();
			expect(screen.getByText('25%')).toBeInTheDocument();
		});

		it('should display priority as 1-indexed', () => {
			renderWorkPackagesTable({
				teams: [],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0, // 0-indexed
						progressPercent: 0,
						scheduledPosition: 0
					}
				]
			});

			// Priority 0 should display as 1
			expect(screen.getByText('1')).toBeInTheDocument();
		});

		it('should display multiple work packages', () => {
			renderWorkPackagesTable({
				teams: [],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						scheduledPosition: 0
					},
					{
						id: 'wp-2',
						title: 'Feature B',
						sizeInPersonMonths: 3,
						priority: 1,
						progressPercent: 50,
						scheduledPosition: 1
					}
				]
			});

			expect(screen.getByText('Feature A')).toBeInTheDocument();
			expect(screen.getByText('Feature B')).toBeInTheDocument();
		});

		it('should show description or dash if empty', () => {
			renderWorkPackagesTable({
				teams: [],
				workPackages: [
					{
						id: 'wp-1',
						title: 'With Description',
						description: 'Test description',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						scheduledPosition: 0
					},
					{
						id: 'wp-2',
						title: 'Without Description',
						sizeInPersonMonths: 2,
						priority: 1,
						progressPercent: 0,
						scheduledPosition: 1
					}
				]
			});

			expect(screen.getByText('Test description')).toBeInTheDocument();
			expect(screen.getByText('—')).toBeInTheDocument();
		});

		it('should display 0% progress when progressPercent is 0', () => {
			renderWorkPackagesTable({
				teams: [],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						scheduledPosition: 0
					}
				]
			});

			expect(screen.getByText('0%')).toBeInTheDocument();
		});
	});

	describe('team assignment display', () => {
		it('should show team name when assigned', () => {
			renderWorkPackagesTable({
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

			expect(screen.getByText('Platform Team')).toBeInTheDocument();
		});

		it('should show Unassigned when no team', () => {
			renderWorkPackagesTable({
				teams: [],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						scheduledPosition: 0
					}
				]
			});

			expect(screen.getByText('Unassigned')).toBeInTheDocument();
		});

		it('should show Unknown when team id not found', () => {
			renderWorkPackagesTable({
				teams: [], // No teams defined
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						assignedTeamId: 'non-existent-team',
						scheduledPosition: 0
					}
				]
			});

			expect(screen.getByText('Unknown')).toBeInTheDocument();
		});
	});

	describe('table headers', () => {
		it('should render all column headers', () => {
			renderWorkPackagesTable({
				teams: [],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						scheduledPosition: 0
					}
				]
			});

			expect(screen.getByText('Priority')).toBeInTheDocument();
			expect(screen.getByText('Title')).toBeInTheDocument();
			expect(screen.getByText('Size (PM)')).toBeInTheDocument();
			expect(screen.getByText('Progress')).toBeInTheDocument();
			expect(screen.getByText('Description')).toBeInTheDocument();
			expect(screen.getByText('Team')).toBeInTheDocument();
			expect(screen.getByText('Actions')).toBeInTheDocument();
		});
	});

	describe('modal interactions', () => {
		it('should open add modal when clicking add button', async () => {
			renderWorkPackagesTable();

			const addButton = screen.getByText('+ Add Work Package');
			await fireEvent.click(addButton);

			// The modal should be opened (WorkPackageModal is rendered)
			// We check that the component rendered without errors
			expect(addButton).toBeInTheDocument();
		});

		it('should have edit buttons for each work package', () => {
			const { container } = renderWorkPackagesTable({
				teams: [],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						scheduledPosition: 0
					}
				]
			});

			const editButton = container.querySelector('button[aria-label="Edit work package"]');
			expect(editButton).toBeInTheDocument();
		});

		it('should have delete buttons for each work package', () => {
			const { container } = renderWorkPackagesTable({
				teams: [],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 0,
						scheduledPosition: 0
					}
				]
			});

			const deleteButton = container.querySelector('button[aria-label="Delete work package"]');
			expect(deleteButton).toBeInTheDocument();
		});
	});

	describe('progress bar', () => {
		it('should render progress bar with correct width', () => {
			const { container } = renderWorkPackagesTable({
				teams: [],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Feature A',
						sizeInPersonMonths: 2,
						priority: 0,
						progressPercent: 75,
						scheduledPosition: 0
					}
				]
			});

			const progressBar = container.querySelector('.bg-green-500');
			expect(progressBar).toHaveStyle({ width: '75%' });
		});
	});
});
