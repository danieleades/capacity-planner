<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { createAppStore } from '$lib/stores/appState';
	import { calculateTeamSchedule, type ScheduledWorkPackage } from '$lib/utils/capacity';
	import { getNextMonthsFrom, getMonthsInRange, formatYearMonth } from '$lib/utils/dates';
	import { YearMonth, type Team } from '$lib/types';

	interface Props {
		planningStartDate: Date;
	}

	let { planningStartDate }: Props = $props();

	// Get stores from context
	const appState = getContext<ReturnType<typeof createAppStore>>('appState');
	const teams = getContext<Readable<Team[]>>('teams');

	// Configuration
	const MIN_TIMELINE_MONTHS = 6;
	const COLUMN_WIDTH_PX = 80; // Minimum width per month column

	let planningStartMonth = $derived(YearMonth.fromDate(planningStartDate).toString());

	// Team colors for visual distinction
	const teamColors = [
		{ bg: 'bg-blue-500', light: 'bg-blue-100', border: 'border-blue-300' },
		{ bg: 'bg-green-500', light: 'bg-green-100', border: 'border-green-300' },
		{ bg: 'bg-purple-500', light: 'bg-purple-100', border: 'border-purple-300' },
		{ bg: 'bg-orange-500', light: 'bg-orange-100', border: 'border-orange-300' },
		{ bg: 'bg-pink-500', light: 'bg-pink-100', border: 'border-pink-300' },
		{ bg: 'bg-teal-500', light: 'bg-teal-100', border: 'border-teal-300' },
	];

	function getTeamColor(index: number) {
		return teamColors[index % teamColors.length];
	}

	// Calculate schedules for all teams
	interface TeamSchedule {
		team: Team;
		schedule: ScheduledWorkPackage[];
		colorIndex: number;
	}

	let teamSchedules = $derived.by(() => {
		const schedules: TeamSchedule[] = [];
		$teams.forEach((team, index) => {
			const teamWPs = $appState.workPackages.filter((wp) => wp.assignedTeamId === team.id);
			const schedule = calculateTeamSchedule(team, teamWPs, planningStartDate);
			schedules.push({ team, schedule, colorIndex: index });
		});
		return schedules;
	});

	// Calculate timeline range dynamically based on scheduled work
	let timelineMonths = $derived.by(() => {
		const startMonth = planningStartMonth;

		// Find the latest end date across all schedules
		let latestEndMonth = startMonth;
		for (const { schedule } of teamSchedules) {
			for (const swp of schedule) {
				const endYearMonth = YearMonth.fromDate(swp.endDate).toString();
				if (endYearMonth > latestEndMonth) {
					latestEndMonth = endYearMonth;
				}
			}
		}

		// Use the range from current month to latest end, with minimum of MIN_TIMELINE_MONTHS
		const minEndMonths = getNextMonthsFrom(planningStartDate, MIN_TIMELINE_MONTHS);
		const minEndMonth = minEndMonths[minEndMonths.length - 1];

		const effectiveEndMonth = latestEndMonth > minEndMonth ? latestEndMonth : minEndMonth;

		return getMonthsInRange(startMonth, effectiveEndMonth);
	});

	// Calculate the position and width of a bar in the timeline
	function calculateBarPosition(
		startYearMonth: string,
		endYearMonth: string
	): { left: string; width: string } | null {
		const startIndex = timelineMonths.indexOf(startYearMonth);
		const endIndex = timelineMonths.indexOf(endYearMonth);

		// If start is before timeline, clamp to start
		const effectiveStart = startIndex === -1 ? 0 : startIndex;

		// If end is after timeline, clamp to end
		const effectiveEnd = endIndex === -1 ? timelineMonths.length - 1 : endIndex;

		// If entirely outside timeline (start after end of timeline)
		if (startIndex === -1 && timelineMonths[0] > startYearMonth === false) {
			// Check if start is after timeline end
			if (startYearMonth > timelineMonths[timelineMonths.length - 1]) {
				return null;
			}
		}

		const columnWidth = 100 / timelineMonths.length;
		const left = effectiveStart * columnWidth;
		const width = (effectiveEnd - effectiveStart + 1) * columnWidth;

		return { left: `${left}%`, width: `${width}%` };
	}

</script>

<div class="rounded-lg bg-white p-6 shadow">
	<h2 class="mb-4 text-lg font-semibold text-gray-900">Timeline View</h2>

	{#if teamSchedules.length === 0 || teamSchedules.every((ts) => ts.schedule.length === 0)}
		<div class="py-12 text-center text-gray-500">
			<p>No scheduled work packages to display.</p>
			<p class="mt-1 text-sm">Assign work packages to teams in the Board view.</p>
		</div>
	{:else}
		{@const timelineWidth = timelineMonths.length * COLUMN_WIDTH_PX}
		<div class="overflow-x-auto">
			<div style="min-width: {timelineWidth + 192}px;">
				<!-- Timeline Header -->
				<div class="flex border-b border-gray-200">
					<div class="w-48 flex-shrink-0 px-3 py-2 text-sm font-medium text-gray-700">
						Team / Work Package
					</div>
					<div class="flex" style="width: {timelineWidth}px;">
						{#each timelineMonths as month (month)}
							<div
								class="border-l border-gray-200 px-1 py-2 text-center text-xs font-medium {month ===
								planningStartMonth
									? 'bg-blue-50 text-blue-700'
									: 'text-gray-600'}"
								style="width: {COLUMN_WIDTH_PX}px;"
							>
								{formatYearMonth(month)}
							</div>
						{/each}
					</div>
				</div>

				<!-- Team Rows -->
				{#each teamSchedules as { team, schedule, colorIndex } (team.id)}
					{@const color = getTeamColor(colorIndex)}
					<!-- Team Header Row -->
					<div class="flex border-b border-gray-100 bg-gray-50">
						<div class="w-48 flex-shrink-0 px-3 py-2">
							<span class="font-medium text-gray-900">{team.name}</span>
							<span class="ml-2 text-xs text-gray-500">
								({schedule.length} work package{schedule.length !== 1 ? 's' : ''})
							</span>
						</div>
						<div class="relative flex" style="width: {timelineWidth}px;">
							{#each timelineMonths as month (month)}
								<div
									class="border-l border-gray-200 {month === planningStartMonth ? 'bg-blue-50/50' : ''}"
									style="width: {COLUMN_WIDTH_PX}px;"
								></div>
							{/each}
						</div>
					</div>

					<!-- Work Package Rows -->
					{#each schedule as swp (swp.workPackage.id)}
						{@const startYM = YearMonth.fromDate(swp.startDate).toString()}
						{@const endYM = YearMonth.fromDate(swp.endDate).toString()}
						{@const position = calculateBarPosition(startYM, endYM)}
						<div class="flex border-b border-gray-100 hover:bg-gray-50">
							<div class="w-48 flex-shrink-0 truncate px-3 py-2 text-sm text-gray-700" title={swp.workPackage.title}>
								<span class="pl-4">{swp.workPackage.title}</span>
							</div>
							<div class="relative flex" style="width: {timelineWidth}px;">
								<!-- Grid lines -->
								{#each timelineMonths as month (month)}
									<div
									class="border-l border-gray-200 {month === planningStartMonth ? 'bg-blue-50/50' : ''}"
										style="width: {COLUMN_WIDTH_PX}px;"
									></div>
								{/each}

								<!-- Gantt Bar -->
								{#if position}
									<div
										class="absolute top-1 bottom-1 rounded {color.bg} flex items-center justify-center overflow-hidden px-2 text-xs font-medium text-white shadow-sm"
										style="left: {position.left}; width: {position.width};"
										title="{swp.workPackage.title}: {formatYearMonth(startYM)} - {formatYearMonth(endYM)}"
									>
										<span class="truncate">
											{swp.workPackage.title}
										</span>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				{/each}
			</div>
		</div>

		<!-- Legend -->
		<div class="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-200 pt-4 text-xs text-gray-600">
			<div class="flex items-center gap-2">
				<div class="h-3 w-6 rounded bg-blue-50 border border-blue-200"></div>
				<span>Planning start</span>
			</div>
			{#each teamSchedules as { team, colorIndex } (team.id)}
				{@const color = getTeamColor(colorIndex)}
				<div class="flex items-center gap-2">
					<div class="h-3 w-6 rounded {color.bg}"></div>
					<span>{team.name}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
