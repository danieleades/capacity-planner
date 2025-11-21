<script lang="ts">
import { getContext } from 'svelte';
import { createAppStore } from '$lib/stores/appState';
import Modal from './Modal.svelte';
import WorkPackageForm from './WorkPackageForm.svelte';
import type { WorkPackage, PlanningPageData } from '$lib/types';
import type { OptimisticEnhanceAction } from '$lib/types/optimistic';
import { generateId } from '$lib/utils/id';

	interface Props {
		optimisticEnhance: OptimisticEnhanceAction<PlanningPageData>;
		open: boolean;
		editingWorkPackage?: WorkPackage;
		onClose: () => void;
	}

	let { optimisticEnhance, open = $bindable(), editingWorkPackage, onClose }: Props = $props();

	// Form state
	let formTitle = $state('');
	let formSize = $state(0);
	let formDescription = $state('');
	let workPackageFormRef = $state<HTMLFormElement | null>(null);
let newWorkPackageId = $state<string>(generateId());
const appState = getContext<ReturnType<typeof createAppStore>>('appState');

	// Update form when editingWorkPackage changes
$effect(() => {
	if (editingWorkPackage) {
		formTitle = editingWorkPackage.title;
		formSize = editingWorkPackage.sizeInPersonMonths;
		formDescription = editingWorkPackage.description || '';
		return;
	}

	if (open) {
		formTitle = '';
		formSize = 0;
		formDescription = '';
		newWorkPackageId = generateId();
	}
});

	function handleSubmit(title: string, size: number, description?: string) {
		// Update form values and submit the form to trigger server action
		formTitle = title;
		formSize = size;
		formDescription = description || '';
		
		// Submit the form
		workPackageFormRef?.requestSubmit();
		
		// Close modal after submission
		onClose();
	}
</script>

<Modal
	bind:open
	title={editingWorkPackage ? 'Edit Work Package' : 'Add Work Package'}
	onClose={onClose}
>
	<form
		bind:this={workPackageFormRef}
		method="POST"
		action={editingWorkPackage ? '?/updateWorkPackage' : '?/createWorkPackage'}
		data-client-action={editingWorkPackage ? undefined : 'create-work-package'}
		use:optimisticEnhance={(data, input) => {
			const title = input.formData.get('title') as string;
			const sizeInPersonMonths = parseFloat(input.formData.get('sizeInPersonMonths') as string);
			const description = input.formData.get('description') as string | null;
			const idValue = input.formData.get('id');
			if (typeof idValue !== 'string' || idValue.length === 0) {
				return;
			}

			// Check if this is an update by looking if the ID already exists in the store
			const existingWorkPackage = appState.findWorkPackageById(idValue);

			if (existingWorkPackage) {
				// Use store operation to update work package
				appState.updateWorkPackage(idValue, {
					title,
					sizeInPersonMonths,
					description: description || undefined
				});
			} else {
				// Use store operation to add work package
				appState.addWorkPackage(title, sizeInPersonMonths, description || undefined, idValue);
			}
		}}
		onsubmit={(e: SubmitEvent) => {
			e.preventDefault();
			// Validation will be done by WorkPackageForm, then it calls handleSubmit
		}}
	>
		{#if editingWorkPackage}
			<input type="hidden" name="id" value={editingWorkPackage.id} />
		{:else}
			<input type="hidden" name="id" value={newWorkPackageId} />
		{/if}
		
		<WorkPackageForm
			bind:title={formTitle}
			bind:size={formSize}
			bind:description={formDescription}
			isEditing={!!editingWorkPackage}
			onSubmit={handleSubmit}
			onCancel={onClose}
		/>
	</form>
</Modal>
