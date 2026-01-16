# Capacity planning

SvelteKit app for interactive capacity planning.

## Setup

```sh
npm install
```

## Database location

By default the app uses `./sqlite.db`. You can override the path:

- `DB_PATH=/path/to/db.sqlite` for a direct file path
- `DATA_DIR=/path/to/dir` to use `/path/to/dir/sqlite.db`

Examples:

```sh
DB_PATH=./dev-data/dev.sqlite npm run dev
DATA_DIR=./prod-data npm run build && DATA_DIR=./prod-data node build
```

## Scripts

- `npm run dev` – start the dev server
- `npm run build` – build for production
- `npm run preview` – preview the built app
- `npm run lint` – run ESLint
- `npm run check` – type and Svelte checks
- `npm run test` – run the test suite
- `npm run test:coverage` – run tests with coverage

## CI & coverage

GitHub Actions run linting, type checking, and tests on pushes and pull requests.  
Test coverage is collected with Vitest and uploaded to Codecov from the CI test job (requires `CODECOV_TOKEN` secret for private repos).
