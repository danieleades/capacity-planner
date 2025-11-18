<script lang="ts">
	import FormError from './FormError.svelte';

	interface Props {
		title: string;
		size: number;
		description: string;
		isEditing: boolean;
		onSubmit: (title: string, size: number, description?: string) => void;
		onCancel: () => void;
	}

	let { title = $bindable(), size = $bindable(), description = $bindable(), isEditing, onSubmit, onCancel }: Props = $props();

	let titleError = $state<string | null>(null);
	let sizeError = $state<string | null>(null);

	function validateForm(): boolean {
		titleError = null;
		sizeError = null;

		let isValid = true;

		if (!title.trim()) {
			titleError = 'Title is required';
			isValid = false;
		} else if (title.trim().length > 200) {
			titleError = 'Title must be 200 characters or less';
			isValid = false;
		}

		if (size <= 0) {
			sizeError = 'Size must be greater than 0';
			isValid = false;
		} else if (isNaN(size)) {
			sizeError = 'Size must be a valid number';
			isValid = false;
		}

		return isValid;
	}
</script>

<div class="mb-4">
	<label for="wp-title" class="mb-1 block text-sm font-medium text-gray-700"> Title </label>
	<input
		id="wp-title"
		name="title"
		type="text"
		bind:value={title}
		class="w-full rounded border px-3 py-2 focus:outline-none focus:ring-1 {titleError
			? 'border-red-300 focus:border-red-500 focus:ring-red-500'
			: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
		placeholder="e.g., Implement user authentication"
		required
	/>
	<FormError error={titleError} />
</div>

<div class="mb-4">
	<label for="wp-size" class="mb-1 block text-sm font-medium text-gray-700">
		Size (person-months)
	</label>
	<input
		id="wp-size"
		name="sizeInPersonMonths"
		type="number"
		step="0.1"
		min="0.1"
		bind:value={size}
		class="w-full rounded border px-3 py-2 focus:outline-none focus:ring-1 {sizeError
			? 'border-red-300 focus:border-red-500 focus:ring-red-500'
			: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
		placeholder="e.g., 1.5"
		required
	/>
	<FormError error={sizeError} />
</div>

<div class="mb-6">
	<label for="wp-description" class="mb-1 block text-sm font-medium text-gray-700">
		Description (optional)
	</label>
	<textarea
		id="wp-description"
		name="description"
		bind:value={description}
		rows="3"
		class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
		placeholder="Brief description of the work package..."
	></textarea>
</div>

<div class="flex justify-end gap-2">
	<button
		type="button"
		onclick={onCancel}
		class="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
	>
		Cancel
	</button>
	<button 
		type="button"
		onclick={() => {
			if (!validateForm()) return;
			onSubmit(title.trim(), size, description.trim() || undefined);
		}}
		class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
	>
		{isEditing ? 'Update' : 'Add'} Work Package
	</button>
</div>
