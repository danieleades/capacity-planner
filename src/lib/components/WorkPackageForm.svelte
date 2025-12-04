<script lang="ts">
	import FormError from './FormError.svelte';

	interface Props {
		title: string;
		size: number;
		description: string;
		progressPercent: number;
		isEditing: boolean;
		onSubmit: (title: string, size: number, description?: string, progressPercent?: number) => void;
		onCancel: () => void;
	}

	let { title = $bindable(), size = $bindable(), description = $bindable(), progressPercent = $bindable(), isEditing, onSubmit, onCancel }: Props = $props();

	// Calculate remaining work based on current values
	let remainingWork = $derived(size * (1 - progressPercent / 100));

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

		if (isNaN(size)) {
			sizeError = 'Size must be a valid number';
			isValid = false;
		} else if (size <= 0) {
			sizeError = 'Size must be greater than 0';
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
		oninput={(e) => {
			const target = e.currentTarget as HTMLInputElement;
			size = target.valueAsNumber;
		}}
		class="w-full rounded border px-3 py-2 focus:outline-none focus:ring-1 {sizeError
			? 'border-red-300 focus:border-red-500 focus:ring-red-500'
			: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
		placeholder="e.g., 1.5"
		required
	/>
	<FormError error={sizeError} />
</div>

<div class="mb-4">
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

{#if isEditing}
	<div class="mb-6">
		<label for="wp-progress" class="mb-1 block text-sm font-medium text-gray-700">
			Progress
		</label>
		<div class="flex items-center gap-3">
			<input
				id="wp-progress"
				name="progressPercent"
				type="range"
				min="0"
				max="100"
				step="5"
				bind:value={progressPercent}
				class="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-green-600"
			/>
			<span class="w-12 text-right font-mono text-sm">{progressPercent}%</span>
		</div>
		<p class="mt-1 text-xs text-gray-500">
			Remaining: {remainingWork.toFixed(1)} PM of {size} PM total
		</p>
	</div>
{/if}

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
			onSubmit(title.trim(), size, description.trim() || undefined, isEditing ? progressPercent : undefined);
		}}
		class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
	>
		{isEditing ? 'Update' : 'Add'} Work Package
	</button>
</div>
