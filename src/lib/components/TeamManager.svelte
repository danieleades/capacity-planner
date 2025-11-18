<script lang="ts">
	import { teams } from '$lib/stores/appState';
	import type { OptimisticEnhanceAction } from '$lib/types/optimistic';
	import type { Team, WorkPackage, PlanningPageData } from '$lib/types';
	import Modal from './Modal.svelte';
	import FormError from './FormError.svelte';
	import CapacitySparkline from './CapacitySparkline.svelte';
	import { getNextMonths, formatYearMonth } from '$lib/utils/dates';

	interface Props {
		optimisticEnhance: OptimisticEnhanceAction<PlanningPageData>;
	}

	let { optimisticEnhance }: Props = $props();

	let showAddModal = $state(false);
	let editingTeam = $state<string | null>(null);
	let formName = $state('');
	let formCapacity = $state(0);
	let nameError = $state<string | null>(null);
	let capacityError = $state<string | null>(null);
	let teamFormRef = $state<HTMLFormElement | null>(null);

	function openAddModal() {
		formName = '';
		formCapacity = 0;
		editingTeam = null;
		nameError = null;
		capacityError = null;
		showAddModal = true;
	}

	function openEditModal(teamId: string) {
		const team = $teams.find((t) => t.id === teamId);
		if (team) {
			formName = team.name;
			formCapacity = team.monthlyCapacityInPersonMonths;
			editingTeam = teamId;
			nameError = null;
			capacityError = null;
			showAddModal = true;
		}
	}

	function closeModal() {
		showAddModal = false;
		editingTeam = null;
		formName = '';
		formCapacity = 0;
		nameError = null;
		capacityError = null;
	}

	function validateForm(): boolean {
		nameError = null;
		capacityError = null;

		let isValid = true;

		if (!formName.trim()) {
			nameError = 'Team name is required';
			isValid = false;
		} else if (formName.trim().length > 100) {
			nameError = 'Team name must be 100 characters or less';
			isValid = false;
		}

		if (formCapacity <= 0) {
			capacityError = 'Capacity must be greater than 0';
			isValid = false;
		} else if (isNaN(formCapacity)) {
			capacityError = 'Capacity must be a valid number';
			isValid = false;
		}

		return isValid;
	}

	function handleDelete(teamId: string) {
		if (confirm('Are you sure you want to delete this team? Work packages will be unassigned.')) {
			const form = document.getElementById(`delete-form-${teamId}`) as HTMLFormElement;
			if (form) {
				form.requestSubmit();
			}
		}
	}
</script>

<div class="mb-6">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-bold">Teams</h2>
		<button
			onclick={openAddModal}
			class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
		>
			+ Add Team
		</button>
	</div>

	{#if $teams.length === 0}
		<p class="text-gray-500">No teams yet. Add a team to get started.</p>
	{:else}
		<div class="space-y-4">
			{#each $teams as team (team.id)}
				<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
					<!-- Hidden delete form -->
					<form
						id="delete-form-{team.id}"
						method="POST"
						action="?/deleteTeam"
						use:optimisticEnhance={(data, input) => {
							// Optimistically remove the team
							const teamId = input.formData.get('id') as string;
							
							if (data.initialState) {
								// Remove team from teams array
								data.initialState.teams = data.initialState.teams.filter((t: Team) => t.id !== teamId);
								
								// Unassign work packages from this team
								data.initialState.workPackages = data.initialState.workPackages.map((wp: WorkPackage) =>
									wp.assignedTeamId === teamId ? { ...wp, assignedTeamId: undefined } : wp
								);
							}
						}}
						style="display: none;"
					>
						<input type="hidden" name="id" value={team.id} />
					</form>
					
					<!-- Team Header -->
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center gap-4">
							<h3 class="text-xl font-semibold">{team.name}</h3>
							<div class="flex items-center gap-2 text-sm text-gray-600">
								<span>Default: {team.monthlyCapacityInPersonMonths} PM/month</span>
								<CapacitySparkline {team} />
							</div>
						</div>
						<div class="flex gap-2">
							<button
								onclick={() => openEditModal(team.id)}
								class="text-blue-600 hover:text-blue-800"
								aria-label="Edit team"
							>
								<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
									/>
								</svg>
							</button>
							<button
								onclick={() => handleDelete(team.id)}
								class="text-red-600 hover:text-red-800"
								aria-label="Delete team"
							>
								<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>

					<!-- Capacity Management Inline -->
					<div class="border-t border-gray-200 pt-4">
						<h4 class="mb-3 text-sm font-semibold text-gray-700">Monthly Capacity (next 6 months)</h4>
						<div class="grid grid-cols-6 gap-3">
							{#each getNextMonths(6) as yearMonth (yearMonth)}
								{@const override = team.capacityOverrides?.find((co) => co.yearMonth === yearMonth)}
								{@const capacity = override ? override.capacity : team.monthlyCapacityInPersonMonths}
								<div class="space-y-1">
									<label for="capacity-{team.id}-{yearMonth}" class="block text-xs font-medium text-gray-600">
										{formatYearMonth(yearMonth)}
									</label>
									<form 
										method="POST" 
										action="?/updateCapacity" 
										use:optimisticEnhance={(data, input) => {
											// Optimistically update the data
											const teamId = input.formData.get('teamId') as string;
											const yearMonth = input.formData.get('yearMonth') as string;
											const newCapacity = parseFloat(input.formData.get('capacity') as string);
											
											if (data.initialState) {
												const teamIndex = data.initialState.teams.findIndex((t: Team) => t.id === teamId);
												if (teamIndex !== -1) {
													const team = data.initialState.teams[teamIndex];
													const defaultCapacity = team.monthlyCapacityInPersonMonths;
													
													if (newCapacity !== defaultCapacity) {
														// Add or update override
														const overrides = team.capacityOverrides || [];
														const overrideIndex = overrides.findIndex((o: { yearMonth: string; capacity: number }) => o.yearMonth === yearMonth);
														
														if (overrideIndex !== -1) {
															overrides[overrideIndex].capacity = newCapacity;
														} else {
															overrides.push({ yearMonth, capacity: newCapacity });
														}
														
														data.initialState.teams[teamIndex].capacityOverrides = overrides;
													} else {
														// Remove override if it matches default
														if (team.capacityOverrides) {
															data.initialState.teams[teamIndex].capacityOverrides = 
																team.capacityOverrides.filter((o: { yearMonth: string; capacity: number }) => o.yearMonth !== yearMonth);
														}
													}
												}
											}
										}}
									>
										<input type="hidden" name="teamId" value={team.id} />
										<input type="hidden" name="yearMonth" value={yearMonth} />
										<input
											id="capacity-{team.id}-{yearMonth}"
											name="capacity"
											type="number"
											step="0.1"
											min="0"
											value={capacity}
											onchange={(e) => {
												// Submit the form (optimistic update will happen automatically)
												e.currentTarget.form?.requestSubmit();
											}}
											class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										/>
									</form>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<Modal bind:open={showAddModal} title={editingTeam ? 'Edit Team' : 'Add Team'} onClose={closeModal}>
	<form
		bind:this={teamFormRef}
		method="POST"
		action={editingTeam ? '?/updateTeam' : '?/createTeam'}
		use:optimisticEnhance={(data, input) => {
			// Optimistically update the data
			const name = input.formData.get('name') as string;
			const monthlyCapacity = parseFloat(input.formData.get('monthlyCapacity') as string);
			
			if (data.initialState) {
				if (editingTeam) {
					// Update existing team
					const teamIndex = data.initialState.teams.findIndex((t: Team) => t.id === editingTeam);
					if (teamIndex !== -1) {
						data.initialState.teams[teamIndex] = {
							...data.initialState.teams[teamIndex],
							name,
							monthlyCapacityInPersonMonths: monthlyCapacity
						};
					}
				} else {
					// Add new team
					const newTeam: Team = {
						id: crypto.randomUUID(),
						name,
						monthlyCapacityInPersonMonths: monthlyCapacity,
						capacityOverrides: []
					};
					data.initialState.teams.push(newTeam);
				}
			}
		}}
		onsubmit={(e: SubmitEvent) => {
			e.preventDefault();
			if (!validateForm()) return;
			
			// Let the form submit naturally with optimisticEnhance
			(e.currentTarget as HTMLFormElement).requestSubmit();
			closeModal();
		}}
	>
		{#if editingTeam}
			<input type="hidden" name="id" value={editingTeam} />
		{/if}
		
		<div class="mb-4">
			<label for="team-name" class="mb-1 block text-sm font-medium text-gray-700">
				Team Name
			</label>
			<input
				id="team-name"
				name="name"
				type="text"
				bind:value={formName}
				class="w-full rounded border px-3 py-2 focus:outline-none focus:ring-1 {nameError
					? 'border-red-300 focus:border-red-500 focus:ring-red-500'
					: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
				placeholder="e.g., Platform Team"
				required
			/>
			<FormError error={nameError} />
		</div>

		<div class="mb-6">
			<label for="team-capacity" class="mb-1 block text-sm font-medium text-gray-700">
				Monthly Capacity (person-months)
			</label>
			<input
				id="team-capacity"
				name="monthlyCapacity"
				type="number"
				step="0.1"
				min="0.1"
				bind:value={formCapacity}
				class="w-full rounded border px-3 py-2 focus:outline-none focus:ring-1 {capacityError
					? 'border-red-300 focus:border-red-500 focus:ring-red-500'
					: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
				placeholder="e.g., 2.5"
				required
			/>
			<FormError error={capacityError} />
			<p class="mt-1 text-xs text-gray-500">
				How many person-months of work can this team complete per month?
			</p>
		</div>

		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={closeModal}
				class="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
			>
				Cancel
			</button>
			<button type="submit" class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
				{editingTeam ? 'Update' : 'Add'} Team
			</button>
		</div>
	</form>
</Modal>
