<script lang="ts">
	import { appState, teams } from '$lib/stores/appState';
	import Modal from './Modal.svelte';
	import CapacitySparkline from './CapacitySparkline.svelte';
	import { getNextMonths, formatYearMonth } from '$lib/utils/dates';

	let showAddModal = $state(false);
	let editingTeam = $state<string | null>(null);
	let formName = $state('');
	let formCapacity = $state(0);

	function openAddModal() {
		formName = '';
		formCapacity = 0;
		editingTeam = null;
		showAddModal = true;
	}

	function openEditModal(teamId: string) {
		const team = $teams.find((t) => t.id === teamId);
		if (team) {
			formName = team.name;
			formCapacity = team.monthlyCapacityInPersonMonths;
			editingTeam = teamId;
			showAddModal = true;
		}
	}

	function closeModal() {
		showAddModal = false;
		editingTeam = null;
		formName = '';
		formCapacity = 0;
	}

	function handleSubmit() {
		if (!formName.trim() || formCapacity <= 0) return;

		if (editingTeam) {
			appState.updateTeam(editingTeam, {
				name: formName.trim(),
				monthlyCapacityInPersonMonths: formCapacity,
			});
		} else {
			appState.addTeam(formName.trim(), formCapacity);
		}

		closeModal();
	}

	function handleDelete(teamId: string) {
		if (confirm('Are you sure you want to delete this team? Work packages will be unassigned.')) {
			appState.deleteTeam(teamId);
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
									<input
										id="capacity-{team.id}-{yearMonth}"
										type="number"
										step="0.1"
										min="0"
										value={capacity}
										onchange={(e) => {
											const newCapacity = e.currentTarget.valueAsNumber;
											if (isNaN(newCapacity) || newCapacity < 0) return;
											if (newCapacity !== team.monthlyCapacityInPersonMonths) {
												appState.setMonthlyCapacity(team.id, yearMonth, newCapacity);
											} else {
												appState.clearMonthlyCapacity(team.id, yearMonth);
											}
										}}
										class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
									/>
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
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
	>
		<div class="mb-4">
			<label for="team-name" class="mb-1 block text-sm font-medium text-gray-700">
				Team Name
			</label>
			<input
				id="team-name"
				type="text"
				bind:value={formName}
				class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				placeholder="e.g., Platform Team"
				required
			/>
		</div>

		<div class="mb-6">
			<label for="team-capacity" class="mb-1 block text-sm font-medium text-gray-700">
				Monthly Capacity (person-months)
			</label>
			<input
				id="team-capacity"
				type="number"
				step="0.1"
				min="0.1"
				bind:value={formCapacity}
				oninput={(e) => {
					const val = e.currentTarget.valueAsNumber;
					if (!isNaN(val)) formCapacity = val;
				}}
				class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				placeholder="e.g., 2.5"
				required
			/>
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
