# Capacity Planning Web App - Development Log

## Project Overview
A simple web app for capacity-based planning of work packages across software teams.

## Tech Stack
- **Frontend:** SvelteKit + TypeScript
- **State Management:** Svelte stores
- **Data Persistence:** LocalStorage (single-user)
- **Drag & Drop:** svelte-dnd-action
- **Styling:** TailwindCSS
- **Testing:** Vitest + Playwright
- **Linting:** ESLint + Prettier

## Key Features (MVP)
1. Manage and prioritize work packages (sized in person-months/days)
2. Set monthly capacity per team
3. Assign work packages to teams via drag-and-drop Kanban board
4. Visualize backlog completion dates based on capacity

## Data Model

### WorkPackage
```typescript
{
  id: string
  title: string
  description?: string
  sizeInPersonMonths: number
  priority: number // lower = higher priority
  assignedTeamId?: string
}
```

### Team
```typescript
{
  id: string
  name: string
  monthlyCapacityInPersonMonths: number
}
```

## Project Structure
```
app/
├── src/
│   ├── lib/
│   │   ├── stores/        # Svelte stores for state management
│   │   ├── components/    # Reusable UI components
│   │   ├── types/         # TypeScript type definitions
│   │   └── utils/         # Helper functions (capacity calculations)
│   └── routes/
│       └── +page.svelte   # Main Kanban view
```

## Development Progress

### Completed - MVP
- [x] SvelteKit project initialization with TypeScript
- [x] Installed dependencies (TailwindCSS v4, svelte-dnd-action)
- [x] Set up data model and Svelte stores
- [x] Implemented localStorage persistence
- [x] Built team management UI (add/edit/delete teams)
- [x] Implemented Kanban board with drag-and-drop for work package assignment
- [x] Added "Add Work Package" button directly in unassigned column
- [x] Added capacity calculations and completion date projections
- [x] Set up ESLint and Prettier
- [x] Build passes all type checks and linting
- [x] Pre-populated app with demo data (2 teams, 5 work packages)
- [x] **Fixed drag-and-drop bug** - Properly implemented svelte-dnd-action pattern:
  - Changed from reactive `$derived` state to mutable `$state`
  - Implemented `handleDndConsider` to update local state during drag
  - Added `$effect` to sync local state when store changes externally
  - Work packages no longer disappear during drag operations
- [x] Removed redundant unassigned work packages section
- [x] **Variable Monthly Capacity** - Full implementation:
  - Tab-based navigation (Board/Teams)
  - Month-by-month capacity management UI (next 6 months)
  - Store methods for setting/clearing capacity overrides
  - Capacity sparkline visualization with scale and color-coded bars
  - Blue = current month, Green = custom capacity, Gray = default
  - Reactive updates throughout the app

### Future Enhancements
- [ ] Bulk edit/reorder work packages
- [ ] Export/import data (CSV, JSON)
- [ ] Team member management
- [ ] Historical capacity tracking
- [ ] Edit work packages from Kanban cards
- [ ] Extended capacity planning (12+ months)

## Getting Started

```bash
npm install

# Development mode (demo data by default)
npm run dev

# Use production data in development (override)
DEMO_MODE=false npm run dev

# Production build (uses app-state.json)
npm run build
npm run preview
```

Then open http://localhost:5173 in your browser.

### Available Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run check` - Run Svelte type checking

## Technical Notes

### Data Persistence
The app uses server-side file storage for data persistence:

- **Storage location**: `data/app-state.json` (production) or `data/demo-state.json` (demo mode)
- **Storage module**: `src/lib/server/storage.ts` handles file read/write operations
- **API endpoints**: `/api/state` (GET/PUT) for client-server communication
- **SSR integration**: State loaded during server-side rendering (eliminates flickering)
- **Auto-save**: Client changes debounced (1 second) and automatically saved to server

**Environment variables:**
- `DEMO_MODE=true` - Load demo data instead of production data
- Use `.env.example` as template for local `.env` file

**Migration path:**
- Current: File-based storage on server
- Future: Easy to swap for database (PostgreSQL, SQLite, etc.)
- API layer stays the same, just change storage implementation

### Drag-and-Drop Implementation
The Kanban board uses `svelte-dnd-action` with the correct pattern:
- **Local mutable state** (`$state`) for columns to support drag operations
- **`handleDndConsider`** updates local state during drag for visual feedback
- **`handleDndFinalize`** updates local state AND persists to store
- **`$effect`** syncs local state when store changes (add/edit/delete operations)

This avoids conflicts between the DnD library's temporary state and Svelte's reactive system.

### Priority Management Philosophy
The app maintains two separate orderings for work packages:

1. **Priority** (`priority` field) - Global canonical business priority
   - Managed in the Work Packages table (single source of truth)
   - Lower number = higher priority
   - Never modified by board view operations

2. **Scheduled Position** (`scheduledPosition` field) - Board view sequencing
   - Optional field used for planning/phasing in the board view
   - Persisted across page refreshes
   - Updated when dragging items in the Kanban board
   - Falls back to `priority` if not set
   - Can be reset to priority order with "Reset to priority order" button in unassigned column

This separation allows:
- Collaborative planning discussions with flexible reordering
- Experimentation with work sequencing and team assignments
- Preservation of the canonical priority order established in Work Packages table

## Design Principles
- KISS, YAGNI, DRY
- Use proven technologies
- Prefer existing libraries
- Regular refactoring
- No backwards compatibility concerns (prototype)
- Strong focus on linting and test coverage
