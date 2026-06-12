## Counsel Chat App

Patient–care-team messaging demo built on Next.js and a local Postgres database.

## Getting Started

Requires Node `>=24`.

1. Install dependencies:

```bash
yarn
# or
npm i
```

2. Set up the local database. The app uses a local [PGlite](https://github.com/electric-sql/pglite) database; run the migrations to create the schema and seed data:

```bash
yarn migrate
```

3. Run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `yarn dev` — start the Next.js development server.
- `yarn build` — create a production build.
- `yarn start` — run the production build (run `yarn build` first).
- `yarn lint` — run ESLint.
- `yarn migrate` — apply pending database migrations (safe to re-run; already-applied migrations are skipped).
- `yarn db:reset` — delete the local database and re-apply all migrations from scratch.
