<script lang="ts">
	import { saveError } from '$lib/stores/appState';

	function dismissError() {
		saveError.set(null);
	}
</script>

{#if $saveError}
	<div
		class="fixed left-1/2 top-4 z-50 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-4 shadow-lg"
		role="alert"
	>
		<svg
			class="h-5 w-5 flex-shrink-0 text-red-600"
			fill="currentColor"
			viewBox="0 0 20 20"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				fill-rule="evenodd"
				d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
				clip-rule="evenodd"
			/>
		</svg>
		<div class="flex-1">
			<p class="text-sm font-medium text-red-800">{$saveError}</p>
		</div>
		<button
			type="button"
			onclick={dismissError}
			class="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
			aria-label="Close"
		>
			<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
				<path
					fill-rule="evenodd"
					d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	</div>
{/if}
