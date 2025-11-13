# Code Review – Capacity Planning

## Critical Issues

1. **SSR still renders an empty application and rehydrates later**  
   - Evidence: the store is instantiated with `{ teams: [], workPackages: [] }` at module scope (`src/lib/stores/appState.ts:45-109`) and only populated inside `onMount` on the client (`src/routes/+page.svelte:1-16`). None of the components using `$appState`, `$teams`, or `$unassignedWorkPackages` can see data while the server renders.  
   - Impact: the HTML sent to the browser (and crawlers) always shows “No teams / no work packages”, followed by a full repaint during hydration. This also risks hydration warnings when the client renders a completely different DOM tree.  
   - Recommendation: initialise the store with the `load` data before SSR (e.g., create the store inside `load` and pass it via context, or move the `appState.set` call into a `+page.ts` that runs on both server and client). Avoid long‑lived singletons for per-request state.

2. **Work package priorities still start at 1, contradicting the stated global ordering contract**  
   - Evidence: `addWorkPackage` seeds `maxPriority` with `Math.max(0, …)` and always sets `priority: maxPriority + 1` (`src/lib/stores/operations.ts:97-118`), so the very first work package is assigned priority `1`. The regression is even codified in `operations.test.ts:183-208`.  
   - Impact: fresh stores have a gap at the top of the canonical ordering, and any logic that assumes “priority 0 is the top of the backlog” (Kanban sorting, exporting, planned future rules) never holds. It also defeats the “reset to global priority order” action, because the canonical order is off-by-one from the rendered order.  
   - Recommendation: treat “no existing work packages” as `maxPriority = -1`, or derive the next priority from `state.workPackages.length`. Adjust the tests accordingly so the first item is priority `0`.

## Major Issues

3. **Forecasting metrics disagree with themselves**  
   - Evidence: `simulateWorkCompletion` advances `currentDate` to the first of the next month before returning it (`src/lib/utils/capacity.ts:44-74`), so an engagement that ends in March reports “Apr 1” as the completion date. At the same time, `calculateTeamBacklog` divides `totalWorkMonths` by the default capacity (`team.monthlyCapacityInPersonMonths`) even when overrides slash the capacity to zero for months at a time (`src/lib/utils/capacity.ts:79-88`).  
   - Impact: the board can show “Time to complete: 3 months” while the simulated completion date renders six months later, which erodes trust in the tool and makes it impossible to explain why a backlog supposedly finishes after it already hit zero remaining work.  
   - Recommendation: capture the completion date before incrementing the loop, or keep a separate `completionDate` variable that is only set when `remainingWork` drops to ≤ 0. Reuse the same per-month simulation to compute “months to complete” (e.g., count how many iterations had capacity > 0) so the metrics stay internally consistent.

4. **File persistence is still coupled to `process.cwd()` and “demo mode” is effectively always on**  
   - Evidence: `DATA_DIR` is derived from `join(process.cwd(), 'data')` and the DEMO flag defaults to true unless the environment variable is exactly `'false'` (`src/lib/server/storage.ts:6-22`). Running the built server from a different working directory (systemd service, Docker, PM2, etc.) fails to find the data folder, and production deployments silently keep reading/writing `demo-state.json` unless the operator knows to set an obscure env var.  
   - Impact: environment-dependent data loss—restart the service from `/` and the application appears empty; forget to opt out of demo mode and you will overwrite the shipping demo JSON rather than the real state file.  
   - Recommendation: resolve the data directory via `import.meta.url` (or a config option), and make “demo mode” an explicit opt-in (`process.env.DEMO_MODE === 'true'`). Failing fast when the configured path is invalid is far preferable to silently switching files.

5. **Persistence writes remain whole-file, non-atomic, and last-write-wins**  
   - Evidence: `writeState` simply overwrites the JSON file in place (`src/lib/server/storage.ts:74-84`). The API still expects the client to PUT the entire application state (`src/routes/api/state/+server.ts:24-41`), and the client happily fires that request every time any store update occurs (`src/lib/stores/appState.ts:13-42`).  
   - Impact: two browser tabs will routinely clobber each other, a crash mid-write leaves a truncated JSON file, and even transient validation failures just revert state on the next page reload. None of this meets the “prefer proven solutions” principle in `requirements.md`.  
   - Recommendation: either move to an actual datastore (SQLite) or implement atomic writes (`writeFile` to a temp file + `rename`). Long-term, expose intent-based endpoints (add team, assign work package, etc.) so you never ship the entire object graph across the wire.

6. **Kanban column building is still O(number of teams × number of work packages)**  
   - Evidence: every invalidation runs `buildColumns`, which filters `$appState.workPackages` once to get a team’s cards and again inside `calculateTeamBacklog` (`src/lib/components/KanbanBoard.svelte:66-115`). With 10 teams and 100 work packages, a single drag event triggers more than a thousand iterations plus a multi-year capacity simulation per team.  
   - Impact: drag-and-drop quickly becomes janky as the backlog grows, because recomputing every column and sparkline on each keystroke is quadratic in the number of items.  
   - Recommendation: pre-group work packages by `assignedTeamId` once (e.g., `const byTeam = new Map()`), and reuse that grouped list both for column items and for `calculateTeamBacklog`. Memoising backlog metrics by team (derived store or `Map`) will keep DnD responsive even as the dataset scales.

## Minor / Refactoring Opportunities

7. **Numeric fields still reimplement `bind:valueAsNumber` in multiple places**  
   - Evidence: `WorkPackageForm.svelte:37-54` and `TeamManager.svelte:127-190` manually grab `event.currentTarget.valueAsNumber` and guard it, despite the TODO in `todo.md` claiming the migration was complete.  
   - Impact: every numeric input duplicates coercion logic, and the current approach silently ignores `NaN` instead of resetting the field, which is easy to forget when adding new forms.  
   - Recommendation: use `bind:valueAsNumber` everywhere, optionally wrapping it in a helper component to keep validations consistent.

8. **Validation still allows impossible references and the UI never surfaces failures**  
   - Evidence: `WorkPackageSchema` only constrains `assignedTeamId` to be a string (`src/lib/types/index.ts:43-51`), so a payload referencing a deleted team passes validation and later causes “Unknown” badges and broken forecasts. On top of that, `saveToServer` merely logs validation errors (`src/lib/stores/appState.ts:13-30`), so the user believes everything was saved even when the API rejected the write.  
   - Impact: corrupted states creep in silently, and users have no idea their edits are being discarded, which is a nightmare when multiple operators collaborate.  
   - Recommendation: extend the schema with a refinement that checks every `assignedTeamId` exists in `teams` (and that `scheduledPosition` only appears on items assigned to the same column). Surface API failures via a toast/banner so users know their data is read-only until the issue is fixed.

## Testing Gaps

- There are still no tests covering the “completion date should match the final working month” scenario for `simulateWorkCompletion` or for the inconsistent “months to complete” metric—adding fixtures where a team has changing capacity would reproduce the current off-by-one bug.  
- No integration or component tests cover persistence failures: the client keeps editing the in-memory store even if the API rejects writes, so an automated test that asserts an error is shown when the server returns 400 would protect against regressions when tightening validation further.
