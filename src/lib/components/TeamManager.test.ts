import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TeamManager from './TeamManager.svelte';
import { createAppStore, createDerivedStores } from '$lib/stores/appState';
import type { OptimisticEnhanceAction } from '$lib/types/optimistic';
import type { PlanningPageData } from '$lib/types';
import { testTeamId } from '../../test/utils/test-data';

describe('TeamManager', () => {
	const mockOptimisticEnhance = vi.fn((_node, _callback) => {
		return {
			update: () => {},
			destroy: () => {}
		};
	}) as unknown as OptimisticEnhanceAction<PlanningPageData>;

	let appState: ReturnType<typeof createAppStore>;
	let teams: ReturnType<typeof createDerivedStores>['teams'];

	beforeEach(() => {
		// Create fresh store instances for each test
		appState = createAppStore({ teams: [], workPackages: [] });
		const derivedStores = createDerivedStores(appState);
		teams = derivedStores.teams;
		vi.clearAllMocks();
	});

	describe('form submissions', () => {
		it('should render add team button', () => {
			render(TeamManager, {
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([['teams', teams]])
			});

			expect(screen.getByText('+ Add Team')).toBeInTheDocument();
		});

		it('should have form with createTeam action', async () => {
			const { container } = render(TeamManager, {
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([['teams', teams]])
			});

			// Open modal
			const addButton = screen.getByText('+ Add Team');
			await fireEvent.click(addButton);

			// Check form exists with correct action
			const form = container.querySelector('form[action="?/createTeam"]');
			expect(form).toBeInTheDocument();
			expect(form).toHaveAttribute('method', 'POST');
		});

		it('should display teams from store', () => {
			appState.set({
				teams: [
					{
						id: testTeamId('team-1'),
						name: 'Engineering Team',
						monthlyCapacityInPersonMonths: 5.0,
						capacityOverrides: []
					}
				],
				workPackages: []
			});

			render(TeamManager, {
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([['teams', teams]])
			});

			expect(screen.getByText('Engineering Team')).toBeInTheDocument();
			expect(screen.getByText(/5 PM\/month/i)).toBeInTheDocument();
		});

		it('should have delete form with correct action', () => {
			appState.set({
				teams: [
					{
						id: testTeamId('team-1'),
						name: 'Engineering Team',
						monthlyCapacityInPersonMonths: 5.0,
						capacityOverrides: []
					}
				],
				workPackages: []
			});

			render(TeamManager, {
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([['teams', teams]])
			});

			const deleteForm = document.getElementById('delete-form-team-1');
			expect(deleteForm).toBeInTheDocument();
			expect(deleteForm).toHaveAttribute('action', '?/deleteTeam');
			expect(deleteForm).toHaveAttribute('method', 'POST');
		});

		it('should have capacity update forms with correct action', () => {
			appState.set({
				teams: [
					{
						id: testTeamId('team-1'),
						name: 'Engineering Team',
						monthlyCapacityInPersonMonths: 5.0,
						capacityOverrides: []
					}
				],
				workPackages: []
			});

			const { container } = render(TeamManager, {
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([['teams', teams]])
			});

			// Find capacity input forms
			const capacityForms = container.querySelectorAll('form[action="?/updateCapacity"]');
			expect(capacityForms.length).toBeGreaterThan(0);
		});

		it('should have updateTeam action form', async () => {
			appState.set({
				teams: [
					{
						id: testTeamId('team-1'),
						name: 'Engineering Team',
						monthlyCapacityInPersonMonths: 5.0,
						capacityOverrides: []
					}
				],
				workPackages: []
			});

			const { container } = render(TeamManager, {
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([['teams', teams]])
			});

			// Open edit modal
			const editButton = screen.getByLabelText('Edit team');
			await fireEvent.click(editButton);

			// Check form exists with correct action
			const form = container.querySelector('form[action="?/updateTeam"]');
			expect(form).toBeInTheDocument();
			expect(form).toHaveAttribute('method', 'POST');
		});

		it('should include hidden id input when creating new teams', async () => {
			const { container } = render(TeamManager, {
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([['teams', teams]])
			});

			await fireEvent.click(screen.getByText('+ Add Team'));

			const idInput = container.querySelector('input[type="hidden"][name="id"]') as HTMLInputElement | null;
			expect(idInput).toBeInTheDocument();
			expect(idInput?.value).toBeTruthy();
		});
	});
});
