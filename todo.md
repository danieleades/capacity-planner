# To Do

## Backlog carry-over

- [x] Use a single colour for the capacity sparkline columns (now standardised in `CapacitySparkline.svelte`).

## Code review 2025-01-07

- [x] Stop mutating store state inside derived selectors (`workPackages` currently calls `.sort` directly on `state.workPackages`).
- [x] Rework Kanban drag-and-drop persistence so priorities remain a single global ordering (or split into per-team queues) and the Work Packages table no longer reshuffles unpredictably after a drag.
- [x] When adding a work package, start priorities at 0 instead of 1 so there are no gaps in a fresh store (already implemented).
- [x] Switch every numeric input to `bind:valueAsNumber` (and guard against `NaN`) before persisting team capacities or work package sizes.
- [x] Teach `simulateWorkCompletion` to skip zero-capacity months instead of aborting so future overrides are honoured in the forecast.
- [x] Deduplicate the `AppState` type—move it to a single definition and import it everywhere.
- [x] Remove the unused `WorkPackageManager.svelte` (and consolidate the repeated add/edit modal logic shared between the board and table).
- [x] remove the nesting of the 'app' folder within the project (probably unintentional).