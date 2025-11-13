<script lang="ts">
	import type { Team } from '$lib/types';
	import { getNextMonths, formatYearMonth, getCurrentMonth } from '$lib/utils/dates';

	interface Props {
		team: Team;
		monthCount?: number;
	}

	let { team, monthCount = 6 }: Props = $props();

	// Reactive capacity data that updates when team changes
	let capacityData = $derived.by(() => {
		const months = getNextMonths(monthCount);
		const currentMonth = getCurrentMonth();

		return months.map((yearMonth) => {
			const override = team.capacityOverrides?.find((co) => co.yearMonth === yearMonth);
			return {
				yearMonth,
				capacity: override ? override.capacity : team.monthlyCapacityInPersonMonths,
				isOverride: !!override,
				isCurrent: yearMonth === currentMonth,
			};
		});
	});

	// Calculate max and min capacity for scaling
	let maxCapacity = $derived(Math.max(...capacityData.map((d) => d.capacity)));
	let minCapacity = $derived(Math.min(...capacityData.map((d) => d.capacity)));

	// SVG dimensions
	const width = 100;
	const height = 32;
	let barWidth = $derived(width / monthCount);
	const padding = 1;
</script>

<div class="inline-flex items-center gap-2" title="Capacity: {minCapacity.toFixed(1)}-{maxCapacity.toFixed(1)} PM">
	<svg
		{width}
		{height}
		viewBox="0 0 {width} {height}"
		class="inline-block"
		aria-label="Capacity over next {monthCount} months"
	>
		{#each capacityData as data (data.yearMonth)}
			{@const x = capacityData.indexOf(data) * barWidth}
			{@const barHeight = maxCapacity > 0 ? (data.capacity / maxCapacity) * (height - 4) : 0}
			{@const y = height - barHeight - 2}

			<title>{formatYearMonth(data.yearMonth)}: {data.capacity} PM{data.isCurrent
					? ' (current)'
					: data.isOverride
						? ' (custom)'
						: ' (default)'}</title>
			<rect
				{x}
				{y}
				width={barWidth - padding}
				height={barHeight}
				fill="#3b82f6"
				class="transition-opacity hover:opacity-75"
				rx="1"
			/>
		{/each}
	</svg>
	<span class="text-xs text-gray-400">
		{minCapacity === maxCapacity ? maxCapacity.toFixed(1) : `${minCapacity.toFixed(1)}-${maxCapacity.toFixed(1)}`}
	</span>
</div>
