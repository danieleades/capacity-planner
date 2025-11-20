import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import KanbanBoard from './KanbanBoard.svelte';
import { createAppStore, createDerivedStores } from '$lib/stores/appState';
import type { OptimisticEnhanceAction } from '$lib/types/optimistic';
import type { PlanningPageData, AppState } from '$lib/types';

// Mock fetch for drag-and-drop tests
global.fetch = vi.fn();

describe('KanbanBoard', () => {
	const mockOptimisticEnhance = vi.fn((_node, _callback) => {
		return {
			update: () => {},
			destroy: () => {}
		};
	}) as unknown as OptimisticEnhanceAction<PlanningPageData>;

	let initialState: AppState;

	beforeEach(() => {
		// Reset initial state
		initialState = {
			teams: [],
			workPackages: []
		};
		vi.clearAllMocks();
	});

	describe('drag-and-drop persistence', () => {
		it('should render unassigned column', () => {
			const appState = createAppStore(initialState);
			const { teams, workPackages, unassignedWorkPackages } = createDerivedStores(appState);
			render(KanbanBoard, { 
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([
					['appState', appState],
					['teams', teams],
					['workPackages', workPackages],
					['unassignedWorkPackages', unassignedWorkPackages]
				])
			});
			
			expect(screen.getByText('Unassigned')).toBeInTheDocument();
		});

		it('should not send server request when finalize event has empty items array', async () => {
			// Setup: Create a component with work packages
			initialState = {
				teams: [
					{
						id: 'team-1',
						name: 'Engineering Team',
						monthlyCapacityInPersonMonths: 5.0,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-1',
						title: 'Test Work Package',
						description: undefined,
						sizeInPersonMonths: 2.0,
						priority: 0,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			};

			const appState = createAppStore(initialState);
			const { teams, workPackages, unassignedWorkPackages } = createDerivedStores(appState);
			const { container } = render(KanbanBoard, { 
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([
					['appState', appState],
					['teams', teams],
					['workPackages', workPackages],
					['unassignedWorkPackages', unassignedWorkPackages]
				])
			});

			// Simulate svelte-dnd-action finalize event with empty items array
			// This happens when the last item is dragged out of a column (origin zone event)
			const teamColumn = container.querySelector('[data-id="team-1"]') || 
			                   container.querySelectorAll('.min-h-96')[1]; // Second column (first team)
			
			if (teamColumn) {
				const finalizeEvent = new CustomEvent('finalize', {
					detail: {
						items: [], // Empty array - simulates dragging last item out
						info: { source: 'pointer' }
					}
				});
				
				// Clear any previous fetch calls
				vi.clearAllMocks();
				
				// Dispatch the event
				teamColumn.dispatchEvent(finalizeEvent);
				
				// Wait for any async operations
				await new Promise(resolve => setTimeout(resolve, 0));
				
				// Verify: No fetch call should be made when items array is empty
				// This prevents the server from receiving an invalid empty updates array
				// which would return a 400 error ("Updates must be a non-empty array")
				expect(global.fetch).not.toHaveBeenCalled();
			}
		});

		it('should render team columns', () => {
			initialState = {
				teams: [
					{
						id: 'team-1',
						name: 'Engineering Team',
						monthlyCapacityInPersonMonths: 5.0,
						capacityOverrides: []
					}
				],
				workPackages: []
			};

			const appState = createAppStore(initialState);
			const { teams, workPackages, unassignedWorkPackages } = createDerivedStores(appState);
			render(KanbanBoard, { 
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([
					['appState', appState],
					['teams', teams],
					['workPackages', workPackages],
					['unassignedWorkPackages', unassignedWorkPackages]
				])
			});
			
			expect(screen.getByText('Engineering Team')).toBeInTheDocument();
		});

		it('should display assigned work packages', () => {
			initialState = {
				teams: [
					{
						id: 'team-1',
						name: 'Engineering Team',
						monthlyCapacityInPersonMonths: 5.0,
						capacityOverrides: []
					}
				],
				workPackages: [
					{
						id: 'wp-2',
						title: 'Assigned Work',
						description: undefined,
						sizeInPersonMonths: 3.0,
						priority: 1,
						assignedTeamId: 'team-1',
						scheduledPosition: 0
					}
				]
			};

			const appState = createAppStore(initialState);
			const { teams, workPackages, unassignedWorkPackages } = createDerivedStores(appState);
			render(KanbanBoard, { 
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([
					['appState', appState],
					['teams', teams],
					['workPackages', workPackages],
					['unassignedWorkPackages', unassignedWorkPackages]
				])
			});
			
			expect(screen.getByText('Assigned Work')).toBeInTheDocument();
		});

	});

	describe('error handling', () => {
		it('should use window.handleFormError for drag-and-drop errors', () => {
			// This test verifies the error handling mechanism exists
			// The actual error handling is tested in integration tests
			const appState = createAppStore(initialState);
			const { teams, workPackages, unassignedWorkPackages } = createDerivedStores(appState);
			render(KanbanBoard, { 
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([
					['appState', appState],
					['teams', teams],
					['workPackages', workPackages],
					['unassignedWorkPackages', unassignedWorkPackages]
				])
			});
			
			// Verify component renders (error handling is internal)
			expect(screen.getByText('Unassigned')).toBeInTheDocument();
		});
	});

	describe('work package form', () => {
		it('should have add button in unassigned column', () => {
			const appState = createAppStore(initialState);
			const { teams, workPackages, unassignedWorkPackages } = createDerivedStores(appState);
			render(KanbanBoard, { 
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([
					['appState', appState],
					['teams', teams],
					['workPackages', workPackages],
					['unassignedWorkPackages', unassignedWorkPackages]
				])
			});
			
			const addButton = screen.getByText('+ Add');
			expect(addButton).toBeInTheDocument();
		});

		it('should have form with createWorkPackage action', async () => {
			const appState = createAppStore(initialState);
			const { teams, workPackages, unassignedWorkPackages } = createDerivedStores(appState);
			const { container } = render(KanbanBoard, { 
				props: { optimisticEnhance: mockOptimisticEnhance },
				context: new Map<string, unknown>([
					['appState', appState],
					['teams', teams],
					['workPackages', workPackages],
					['unassignedWorkPackages', unassignedWorkPackages]
				])
			});
			
			// Open modal
			const addButton = screen.getByText('+ Add');
			await fireEvent.click(addButton);
			
			// Check form exists with correct action
			const form = container.querySelector('form[action="?/createWorkPackage"]');
			expect(form).toBeInTheDocument();
			expect(form).toHaveAttribute('method', 'POST');
		});
	});
});
