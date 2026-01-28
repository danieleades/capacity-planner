<script lang="ts">
import { getContext } from 'svelte';
import { createAppStore } from '$lib/stores/appState';
import Modal from './Modal.svelte';
import WorkPackageForm from './WorkPackageForm.svelte';
import type { WorkPackage, PlanningPageData } from '$lib/types';
import { unsafeWorkPackageId, generateWorkPackageId } from '$lib/types';
import type { OptimisticEnhanceAction } from '$lib/types/optimistic';

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
	let formProgressPercent = $state(0);
	let workPackageFormRef = $state<HTMLFormElement | null>(null);
	let newWorkPackageId = $state(generateWorkPackageId());
	const appState = getContext<ReturnType<typeof createAppStore>>('appState');

	// Update form when editingWorkPackage changes
	$effect(() => {
		if (editingWorkPackage) {
			formTitle = editingWorkPackage.title;
			formSize = editingWorkPackage.sizeInPersonMonths;
			formDescription = editingWorkPackage.description || '';
			formProgressPercent = editingWorkPackage.progressPercent ?? 0;
			return;
		}

		if (open) {
			formTitle = '';
			formSize = 0;
			formDescription = '';
			formProgressPercent = 0;
			newWorkPackageId = generateWorkPackageId();
		}
	});

	function handleSubmit(title: string, size: number, description?: string, progressPercent?: number) {
		// Update form values and submit the form to trigger server action
		formTitle = title;
		formSize = size;
		formDescription = description || '';
		if (progressPercent !== undefined) {
			formProgressPercent = progressPercent;
		}

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
			const progressPercentStr = input.formData.get('progressPercent') as string | null;
			const progressPercent = progressPercentStr ? parseInt(progressPercentStr, 10) : undefined;
			const idValue = input.formData.get('id');
			if (typeof idValue !== 'string' || idValue.length === 0) {
				return;
			}
			const workPackageId = unsafeWorkPackageId(idValue);

			// Check if this is an update by looking if the ID already exists in the store
			const existingWorkPackage = appState.findWorkPackageById(workPackageId);

			if (existingWorkPackage) {
				// Use store operation to update work package
				appState.updateWorkPackage(workPackageId, {
					title,
					sizeInPersonMonths,
					description: description || null,
					...(progressPercent !== undefined ? { progressPercent } : {})
				});
			} else {
				// Use store operation to add work package
				appState.addWorkPackage(title, sizeInPersonMonths, description || undefined, workPackageId);
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
			bind:progressPercent={formProgressPercent}
			isEditing={!!editingWorkPackage}
			onSubmit={handleSubmit}
			onCancel={onClose}
		/>
	</form>
</Modal>
