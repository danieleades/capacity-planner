import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createAppStore, createDerivedStores } from './appState';
import type { AppState } from '$lib/types';

describe('appState store', () => {
	let initialState: AppState;

	beforeEach(() => {
		initialState = {
			teams: [],
			workPackages: []
		};
	});

	describe('createAppStore', () => {
		it('should create store with provided initial state', () => {
			const state: AppState = {
				teams: [{ id: 'team-1', name: 'Test Team', monthlyCapacityInPersonMonths: 5, capacityOverrides: [] }],
				workPackages: []
			};
			const store = createAppStore(state);
			expect(get(store).teams).toHaveLength(1);
			expect(get(store).teams[0].name).toBe('Test Team');
		});

		it('should create store with empty state when no initial state provided', () => {
			const store = createAppStore();
			expect(get(store).teams).toHaveLength(0);
			expect(get(store).workPackages).toHaveLength(0);
		});

		describe('findWorkPackageById', () => {
			it('should find work package by id', () => {
				const store = createAppStore({
					teams: [],
					workPackages: [
						{ id: 'wp-1', title: 'Test WP', sizeInPersonMonths: 2, priority: 0, progressPercent: 0, scheduledPosition: 0 }
					]
				});
				const wp = store.findWorkPackageById('wp-1');
				expect(wp).toBeDefined();
				expect(wp?.title).toBe('Test WP');
			});

			it('should return undefined for non-existent id', () => {
				const store = createAppStore(initialState);
				const wp = store.findWorkPackageById('non-existent');
				expect(wp).toBeUndefined();
			});
		});

		describe('team operations', () => {
			it('should add team', () => {
				const store = createAppStore(initialState);
				store.addTeam('New Team', 3.5);
				expect(get(store).teams).toHaveLength(1);
				expect(get(store).teams[0].name).toBe('New Team');
				expect(get(store).teams[0].monthlyCapacityInPersonMonths).toBe(3.5);
			});

			it('should add team with custom id', () => {
				const store = createAppStore(initialState);
				store.addTeam('New Team', 3.5, 'custom-id');
				expect(get(store).teams[0].id).toBe('custom-id');
			});

			it('should update team', () => {
				const store = createAppStore({
					teams: [{ id: 'team-1', name: 'Original', monthlyCapacityInPersonMonths: 5, capacityOverrides: [] }],
					workPackages: []
				});
				store.updateTeam('team-1', { name: 'Updated' });
				expect(get(store).teams[0].name).toBe('Updated');
			});

			it('should delete team', () => {
				const store = createAppStore({
					teams: [{ id: 'team-1', name: 'Test', monthlyCapacityInPersonMonths: 5, capacityOverrides: [] }],
					workPackages: []
				});
				store.deleteTeam('team-1');
				expect(get(store).teams).toHaveLength(0);
			});
		});

		describe('capacity override operations', () => {
			it('should set monthly capacity', () => {
				const store = createAppStore({
					teams: [{ id: 'team-1', name: 'Test', monthlyCapacityInPersonMonths: 5, capacityOverrides: [] }],
					workPackages: []
				});
				store.setMonthlyCapacity('team-1', '2025-01', 3);
				expect(get(store).teams[0].capacityOverrides).toHaveLength(1);
				expect(get(store).teams[0].capacityOverrides![0].capacity).toBe(3);
			});

			it('should clear monthly capacity', () => {
				const store = createAppStore({
					teams: [{ id: 'team-1', name: 'Test', monthlyCapacityInPersonMonths: 5, capacityOverrides: [{ yearMonth: '2025-01', capacity: 3 }] }],
					workPackages: []
				});
				store.clearMonthlyCapacity('team-1', '2025-01');
				expect(get(store).teams[0].capacityOverrides).toHaveLength(0);
			});
		});

		describe('work package operations', () => {
			it('should add work package', () => {
				const store = createAppStore(initialState);
				store.addWorkPackage('New WP', 2.5, 'Description');
				expect(get(store).workPackages).toHaveLength(1);
				expect(get(store).workPackages[0].title).toBe('New WP');
				expect(get(store).workPackages[0].sizeInPersonMonths).toBe(2.5);
				expect(get(store).workPackages[0].description).toBe('Description');
			});

			it('should add work package with custom id', () => {
				const store = createAppStore(initialState);
				store.addWorkPackage('New WP', 2.5, 'Description', 'custom-wp-id');
				expect(get(store).workPackages[0].id).toBe('custom-wp-id');
			});

			it('should update work package', () => {
				const store = createAppStore({
					teams: [],
					workPackages: [{ id: 'wp-1', title: 'Original', sizeInPersonMonths: 1, priority: 0, progressPercent: 0, scheduledPosition: 0 }]
				});
				store.updateWorkPackage('wp-1', { title: 'Updated', sizeInPersonMonths: 3 });
				expect(get(store).workPackages[0].title).toBe('Updated');
				expect(get(store).workPackages[0].sizeInPersonMonths).toBe(3);
			});

			it('should delete work package', () => {
				const store = createAppStore({
					teams: [],
					workPackages: [{ id: 'wp-1', title: 'Test', sizeInPersonMonths: 1, priority: 0, progressPercent: 0, scheduledPosition: 0 }]
				});
				store.deleteWorkPackage('wp-1');
				expect(get(store).workPackages).toHaveLength(0);
			});

			it('should assign work package', () => {
				const store = createAppStore({
					teams: [],
					workPackages: [{ id: 'wp-1', title: 'Test', sizeInPersonMonths: 1, priority: 0, progressPercent: 0, scheduledPosition: 0 }]
				});
				store.assignWorkPackage('wp-1', 'team-1');
				expect(get(store).workPackages[0].assignedTeamId).toBe('team-1');
			});

			it('should batch update work packages', () => {
				const store = createAppStore({
					teams: [],
					workPackages: [
						{ id: 'wp-1', title: 'WP1', sizeInPersonMonths: 1, priority: 0, progressPercent: 0, scheduledPosition: 0 },
						{ id: 'wp-2', title: 'WP2', sizeInPersonMonths: 1, priority: 1, progressPercent: 0, scheduledPosition: 1 }
					]
				});
				store.batchUpdateWorkPackages([
					{ id: 'wp-1', assignedTeamId: 'team-1', scheduledPosition: 0 },
					{ id: 'wp-2', assignedTeamId: 'team-1', scheduledPosition: 1 }
				]);
				expect(get(store).workPackages[0].assignedTeamId).toBe('team-1');
				expect(get(store).workPackages[1].assignedTeamId).toBe('team-1');
			});

			it('should clear unassigned scheduled positions', () => {
				const store = createAppStore({
					teams: [],
					workPackages: [
						{ id: 'wp-1', title: 'WP1', sizeInPersonMonths: 1, priority: 0, progressPercent: 0, scheduledPosition: 5 }
					]
				});
				store.clearUnassignedScheduledPositions();
				expect(get(store).workPackages[0].scheduledPosition).toBeUndefined();
			});
		});
	});

	describe('createDerivedStores', () => {
		it('should derive teams store', () => {
			const appStore = createAppStore({
				teams: [
					{ id: 'team-1', name: 'Team A', monthlyCapacityInPersonMonths: 5, capacityOverrides: [] },
					{ id: 'team-2', name: 'Team B', monthlyCapacityInPersonMonths: 3, capacityOverrides: [] }
				],
				workPackages: []
			});
			const { teams } = createDerivedStores(appStore);
			expect(get(teams)).toHaveLength(2);
			expect(get(teams)[0].name).toBe('Team A');
		});

		it('should derive workPackages store sorted by priority', () => {
			const appStore = createAppStore({
				teams: [],
				workPackages: [
					{ id: 'wp-1', title: 'Low Priority', sizeInPersonMonths: 1, priority: 2, progressPercent: 0, scheduledPosition: 0 },
					{ id: 'wp-2', title: 'High Priority', sizeInPersonMonths: 1, priority: 0, progressPercent: 0, scheduledPosition: 1 },
					{ id: 'wp-3', title: 'Medium Priority', sizeInPersonMonths: 1, priority: 1, progressPercent: 0, scheduledPosition: 2 }
				]
			});
			const { workPackages } = createDerivedStores(appStore);
			const sorted = get(workPackages);
			expect(sorted[0].title).toBe('High Priority');
			expect(sorted[1].title).toBe('Medium Priority');
			expect(sorted[2].title).toBe('Low Priority');
		});

		it('should derive unassignedWorkPackages store', () => {
			const appStore = createAppStore({
				teams: [],
				workPackages: [
					{ id: 'wp-1', title: 'Assigned', sizeInPersonMonths: 1, priority: 0, progressPercent: 0, assignedTeamId: 'team-1', scheduledPosition: 0 },
					{ id: 'wp-2', title: 'Unassigned', sizeInPersonMonths: 1, priority: 1, progressPercent: 0, scheduledPosition: 1 }
				]
			});
			const { unassignedWorkPackages } = createDerivedStores(appStore);
			expect(get(unassignedWorkPackages)).toHaveLength(1);
			expect(get(unassignedWorkPackages)[0].title).toBe('Unassigned');
		});

		it('should sort unassignedWorkPackages by priority', () => {
			const appStore = createAppStore({
				teams: [],
				workPackages: [
					{ id: 'wp-1', title: 'Low', sizeInPersonMonths: 1, priority: 2, progressPercent: 0, scheduledPosition: 0 },
					{ id: 'wp-2', title: 'High', sizeInPersonMonths: 1, priority: 0, progressPercent: 0, scheduledPosition: 1 }
				]
			});
			const { unassignedWorkPackages } = createDerivedStores(appStore);
			const sorted = get(unassignedWorkPackages);
			expect(sorted[0].title).toBe('High');
			expect(sorted[1].title).toBe('Low');
		});

		it('should reactively update when store changes', () => {
			const appStore = createAppStore(initialState);
			const { teams, workPackages } = createDerivedStores(appStore);

			// Initially empty
			expect(get(teams)).toHaveLength(0);
			expect(get(workPackages)).toHaveLength(0);

			// Add team
			appStore.addTeam('New Team', 5);
			expect(get(teams)).toHaveLength(1);

			// Add work package
			appStore.addWorkPackage('New WP', 2);
			expect(get(workPackages)).toHaveLength(1);
		});
	});
});
