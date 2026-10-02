# web-backend

NestJS 11 API for Campus Resource Booking, using PostgreSQL through TypeORM. It serves `http://localhost:18320/api`, with Swagger docs at `/api/docs` outside production.

## Run locally

From the repository root, start PostgreSQL with `docker compose up -d postgres`. Then, in this folder:

```bash
npm install
cp .env.example .env     # local defaults; set a real AUTH_JWT_SECRET for anything shared
npm run migration:run
npm run start:dev
```

To run everything in Docker instead, see the [root README](../README.md).

## How it works

- **Sessions:** login sets the JWT in an `httpOnly` cookie; it is never returned in a response body. Browser clients send requests with `credentials: 'include'`.
- **Secure by default:** every route requires a session unless marked `@Public()`. Restrict routes by role with `@Roles(UserRole.STAFF, ...)`.
- **USTH only:** registration and login accept exact `@usth.edu.vn` addresses.
- **Code layout:** one feature module per folder in `src/` (`auth`, `users`, `resources`, `bookings`, `analytics`, `events`, ...). Controllers handle HTTP, services hold the rules, DTOs validate input and shape responses. Configuration is read only through `src/config/`.
- **Schema:** migrations in `src/database/migrations` are the source of truth; `synchronize` stays off. Migration `1727200000000-RevokeDeactivatedSessions` adds `session_version` without removing historical bookings. Cookies issued before that migration require a new sign-in.
- **Scripts:** the demo data, benchmark and load-test tools live in `src/scripts/`.
- **Accounts:** bootstrap never promotes an existing student or staff account to admin; it can reactivate an inactive admin if no active admin remains. Deactivation increments the user's session version, so old REST and WebSocket cookies remain invalid after reactivation. Bootstrap reactivation also increments the version. Production IP-based login limits require a trusted reverse proxy and a backend that cannot be reached directly ([deployment guidance](../docs/DEPLOYMENT.md)).
- **Discovery:** a date without start and end times finds resources free for their entire operating day (only before that day starts); paired times search an interval. Student bookings are limited to three consecutive whole hours within 08:00–18:00 ICT and the resource's own operating schedule. Checked-in bookings remain protected from incompatible schedule changes and same-day closures until checkout.
- **Arrival:** the student shows the confirmed booking in their account; staff match its full ID, student, resource, and time against `GET /staff/bookings/:id`, then call `PATCH /staff/bookings/:id/confirm-check-in` with **no body**. Only staff/admin can confirm, from the reservation start up to (but not including) its scheduled end. Pending bookings need approval first. The student code-generation endpoint has been removed; existing codes are retired by migration `1727000000000-ManualStaffCheckIn`. After the scheduled end, staff can record a no-show, or the periodic release job records one for unchecked confirmed bookings and expires unreviewed requests; until the write persists, their prior status may still hold the slot.

## Commands

| Command | What it does |
| --- | --- |
| `npm run start:dev` | Start with reload on change |
| `npm run build` / `npm run start:prod` | Compile to `dist/` / run the compiled app |
| `npm run lint` | Lint and auto-fix |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests; need a migrated database from `.env.test` |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:generate -- src/database/migrations/Name` | Generate a migration from entity changes (review it before applying) |
| `npm run migration:revert` | Revert the last migration |
| `npm run demo:seed` / `npm run demo:clean` | Create/remove disposable demo accounts and bookings; requires `DEMO_PASSWORD` and a local non-production database |
| `npm run catalog:import` / `catalog:clean` | Import or remove the demo rooms, labs, and equipment |
| `npm run bench:availability` | Benchmark availability queries ([results](../docs/benchmarks/README.md)) |
| `npm run load:test` | Load and stress test the API in a throwaway database ([results](../docs/benchmarks/performance-comparison.md)) |

## Configuration

Every variable is validated at startup, so a bad value fails immediately. `.env.example` lists them all. The ones you are most likely to change:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AUTH_JWT_SECRET` | — | Signing key, at least 32 characters (required) |
| `CORS_ORIGINS` | `http://localhost:18321` | Allowed frontend origins, comma-separated |
| `AUTH_TOKEN_EXPIRES_IN` | `1d` | Session length |
| `AUTH_COOKIE_SECURE` | `true` in production | HTTPS-only cookie |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | local Compose database | PostgreSQL connection |
| `BOOTSTRAP_ADMIN_*`, `BOOTSTRAP_STAFF_*` | unset | First admin and staff accounts ([root README](../README.md#admin-and-staff-accounts)) |
| `BOOKING_RELEASE_INTERVAL_SECONDS` | `60` | How often missed check-ins and unreviewed requests are released; `0` disables automatic release |
