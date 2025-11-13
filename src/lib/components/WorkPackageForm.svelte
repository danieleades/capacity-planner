<script lang="ts">
	interface Props {
		title: string;
		size: number;
		description: string;
		isEditing: boolean;
		onSubmit: (title: string, size: number, description?: string) => void;
		onCancel: () => void;
	}

	let { title = $bindable(), size = $bindable(), description = $bindable(), isEditing, onSubmit, onCancel }: Props = $props();

	function handleSubmit() {
		if (!title.trim() || size <= 0) return;
		onSubmit(title.trim(), size, description.trim() || undefined);
	}
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
>
	<div class="mb-4">
		<label for="wp-title" class="mb-1 block text-sm font-medium text-gray-700"> Title </label>
		<input
			id="wp-title"
			type="text"
			bind:value={title}
			class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			placeholder="e.g., Implement user authentication"
			required
		/>
	</div>

	<div class="mb-4">
		<label for="wp-size" class="mb-1 block text-sm font-medium text-gray-700">
			Size (person-months)
		</label>
		<input
			id="wp-size"
			type="number"
			step="0.1"
			min="0.1"
			bind:value={size}
			oninput={(e) => {
				const val = e.currentTarget.valueAsNumber;
				if (!isNaN(val)) size = val;
			}}
			class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			placeholder="e.g., 1.5"
			required
		/>
	</div>

	<div class="mb-6">
		<label for="wp-description" class="mb-1 block text-sm font-medium text-gray-700">
			Description (optional)
		</label>
		<textarea
			id="wp-description"
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
		<button type="submit" class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
			{isEditing ? 'Update' : 'Add'} Work Package
		</button>
	</div>
</form>
