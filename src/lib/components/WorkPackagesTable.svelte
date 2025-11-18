<script lang="ts">
	import { appState, workPackages } from '$lib/stores/appState';
	import type { WorkPackage, PlanningPageData } from '$lib/types';
	import type { OptimisticEnhanceAction } from '$lib/types/optimistic';
	import Modal from './Modal.svelte';
	import WorkPackageForm from './WorkPackageForm.svelte';

	interface Props {
		optimisticEnhance: OptimisticEnhanceAction<PlanningPageData>;
	}

	let { optimisticEnhance }: Props = $props();

	let showAddModal = $state(false);
	let editingWorkPackage = $state<string | null>(null);
	let formTitle = $state('');
	let formSize = $state(0);
	let formDescription = $state('');
	let workPackageFormRef = $state<HTMLFormElement | null>(null);
	let deleteFormRefs: Record<string, HTMLFormElement | null> = {};

	function openAddModal() {
		formTitle = '';
		formSize = 0;
		formDescription = '';
		editingWorkPackage = null;
		showAddModal = true;
	}

	function openEditModal(workPackageId: string) {
		const wp = $workPackages.find((w) => w.id === workPackageId);
		if (wp) {
			formTitle = wp.title;
			formSize = wp.sizeInPersonMonths;
			formDescription = wp.description || '';
			editingWorkPackage = workPackageId;
			showAddModal = true;
		}
	}

	function closeModal() {
		showAddModal = false;
		editingWorkPackage = null;
		formTitle = '';
		formSize = 0;
		formDescription = '';
	}

	function handleSubmit(title: string, size: number, description?: string) {
		// Update form values and submit the form to trigger server action
		formTitle = title;
		formSize = size;
		formDescription = description || '';
		
		// Submit the form
		workPackageFormRef?.requestSubmit();
		
		// Close modal after submission
		closeModal();
	}

	function handleDelete(workPackageId: string) {
		if (confirm('Are you sure you want to delete this work package?')) {
			const form = deleteFormRefs[workPackageId];
			if (form) {
				form.requestSubmit();
			}
		}
	}
</script>

<div class="mb-6">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-bold">Work Packages</h2>
		<button
			onclick={openAddModal}
			class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
		>
			+ Add Work Package
		</button>
	</div>

	{#if $workPackages.length === 0}
		<p class="text-gray-500">No work packages yet. Add one to get started.</p>
	{:else}
		<!-- Hidden delete forms for each work package -->
		{#each $workPackages as wp (wp.id)}
			<form
				bind:this={deleteFormRefs[wp.id]}
				method="POST"
				action="?/deleteWorkPackage"
				use:optimisticEnhance={(data, input) => {
					// Optimistically remove the work package
					const workPackageId = input.formData.get('id') as string;
					
					if (data.initialState) {
						// Remove work package from array
						data.initialState.workPackages = data.initialState.workPackages.filter((wp: WorkPackage) => wp.id !== workPackageId);
					}
				}}
				style="display: none;"
			>
				<input type="hidden" name="id" value={wp.id} />
			</form>
		{/each}
		
		<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
			<table class="w-full">
				<thead class="border-b border-gray-200 bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Priority</th>
						<th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
						<th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Size (PM)</th>
						<th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
						<th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Team</th>
						<th class="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each $workPackages as wp (wp.id)}
						<tr class="border-b border-gray-100 hover:bg-gray-50">
							<td class="px-4 py-3 text-sm text-gray-900">{wp.priority + 1}</td>
							<td class="px-4 py-3 text-sm font-medium text-gray-900">{wp.title}</td>
							<td class="px-4 py-3 text-sm text-gray-900">{wp.sizeInPersonMonths}</td>
							<td class="px-4 py-3 text-sm text-gray-600">
								{wp.description || '—'}
							</td>
							<td class="px-4 py-3 text-sm text-gray-600">
								{#if wp.assignedTeamId}
									{@const team = $appState.teams.find((t) => t.id === wp.assignedTeamId)}
									<span class="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
										{team?.name || 'Unknown'}
									</span>
								{:else}
									<span class="text-gray-400">Unassigned</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								<div class="flex justify-end gap-2">
									<button
										onclick={() => openEditModal(wp.id)}
										class="text-blue-600 hover:text-blue-800"
										aria-label="Edit work package"
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
										onclick={() => handleDelete(wp.id)}
										class="text-red-600 hover:text-red-800"
										aria-label="Delete work package"
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
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<Modal
	bind:open={showAddModal}
	title={editingWorkPackage ? 'Edit Work Package' : 'Add Work Package'}
	onClose={closeModal}
>
	<form
		bind:this={workPackageFormRef}
		method="POST"
		action={editingWorkPackage ? '?/updateWorkPackage' : '?/createWorkPackage'}
		use:optimisticEnhance={(data, input) => {
			// Optimistically update the data
			const title = input.formData.get('title') as string;
			const sizeInPersonMonths = parseFloat(input.formData.get('sizeInPersonMonths') as string);
			const description = input.formData.get('description') as string | null;
			
			if (data.initialState) {
				if (editingWorkPackage) {
					// Update existing work package
					const wpIndex = data.initialState.workPackages.findIndex((wp: WorkPackage) => wp.id === editingWorkPackage);
					if (wpIndex !== -1) {
						data.initialState.workPackages[wpIndex] = {
							...data.initialState.workPackages[wpIndex],
							title,
							sizeInPersonMonths,
							description: description || undefined
						};
					}
				} else {
					// Add new work package
					const newWorkPackage: WorkPackage = {
						id: crypto.randomUUID(),
						title,
						sizeInPersonMonths,
						description: description || undefined,
						priority: data.initialState.workPackages.length,
						assignedTeamId: undefined
					};
					data.initialState.workPackages.push(newWorkPackage);
				}
			}
		}}
		onsubmit={(e: SubmitEvent) => {
			e.preventDefault();
			// Validation will be done by WorkPackageForm, then it calls handleSubmit
		}}
	>
		{#if editingWorkPackage}
			<input type="hidden" name="id" value={editingWorkPackage} />
		{/if}
		<input type="hidden" name="priority" value={$workPackages.length} />
		
		<WorkPackageForm
			bind:title={formTitle}
			bind:size={formSize}
			bind:description={formDescription}
			isEditing={!!editingWorkPackage}
			onSubmit={handleSubmit}
			onCancel={closeModal}
		/>
	</form>
</Modal>
