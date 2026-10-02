# Campus Resource Booking

A USTH web app for finding, booking, approving, and managing university rooms, laboratories, and equipment.

- `web-frontend/` — Next.js 16 and React 19 ([README](web-frontend/README.md))
- `web-backend/` — NestJS 11, TypeORM, and PostgreSQL ([README](web-backend/README.md))
- `docs/` — project proposal, [architecture](docs/ARCHITECTURE.md), [course project guide](docs/COURSE_PROJECT.md), [release checklist](docs/MVP_RELEASE.md), [deployment](docs/DEPLOYMENT.md), [benchmarks](docs/benchmarks/README.md), [presentation kit](docs/presentation/README.md)

## Quick start

Requires Docker with Compose v2. From the repository root:

```bash
cp .env.example .env
openssl rand -base64 48   # paste the output into AUTH_JWT_SECRET in .env
docker compose up -d --build
```

The first build takes a few minutes. Database migrations run automatically **before** the backend starts. On an existing installation, back up the database before upgrading: the manual check-in migration retires outstanding six-digit codes, and migration `1727200000000-RevokeDeactivatedSessions` requires existing users to sign in again without deleting booking history. Confirm all three services are healthy with `docker compose ps` after rebuilding.

| Service | URL |
| --- | --- |
| Frontend | http://localhost:18321 |
| API | http://localhost:18320/api (this machine only) |
| API docs | http://localhost:18320/api/docs |
| PostgreSQL | `localhost:18322` (this machine only) |

## Running the containers

```bash
docker compose up -d            # start
docker compose stop             # stop (containers and data are kept)
docker compose restart          # restart
docker compose up -d --build    # rebuild after pulling code or editing .env
docker compose ps               # status; all services should be "healthy"
docker compose logs -f backend  # follow logs (Ctrl+C to exit)
```

Database data lives in a Docker volume and survives all of the commands above. `docker compose down -v` **deletes it permanently**.

If a port is taken, change `BACKEND_PORT`, `FRONTEND_PORT`, or `DB_HOST_PORT` in `.env`, update `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` to match, then rebuild.

## Admin and staff accounts

Registration only creates students. Set the first admin and staff accounts in `.env`, then run `docker compose up -d`:

```bash
BOOTSTRAP_ADMIN_EMAIL=first.admin@usth.edu.vn
BOOTSTRAP_ADMIN_PASSWORD=<a strong password>
BOOTSTRAP_STAFF_EMAIL=first.staff@usth.edu.vn
BOOTSTRAP_STAFF_PASSWORD=<a strong password>
```

- Accounts are created at backend startup if they don't exist yet (emails must be exact `@usth.edu.vn` addresses; passwords 8+ characters).
- Existing passwords are never rotated by startup: editing a bootstrap password later has no effect. Existing student or staff accounts are **never promoted to admin** merely because their email matches the bootstrap setting. There is currently no in-app password-change/reset flow. Use disposable test accounts for demos; for a real compromised account, disable it and arrange a controlled credential-rotation procedure before restoring access. Do not assume a Compose restart rotates existing passwords.
- If no active admin remains, an **existing inactive administrator** configured as the bootstrap admin is reactivated at the next startup. Deactivating an account revokes its existing sessions; reactivation requires a new sign-in. If no admin account exists, configure a new, unregistered email with a strong bootstrap password and restart.

## Finding availability

Search by date with **Any start** and **Any end** to find resources free for their **entire operating day**, provided that day has not started. To find a free part of a day, choose both **From** and **Until**; the resource's hourly schedule shows the remaining slots. A pending, confirmed, or checked-in booking holds its interval, and a closure blocks that date. Students can reserve up to three consecutive whole hours within 08:00–18:00 ICT, subject to the resource's own operating schedule. The student dashboard shows up to three active resources, not the entire catalog.

## Booking confirmation and staff check-in

Students find their confirmed reservation under **My bookings → View details**. It shows their name and university email, the full booking ID, resource, building/location, date, and time. Requests awaiting approval do **not** count as confirmations. At the resource, students show that screen in their signed-in account; staff compare the booking ID and details with the live record in **Staff → Arrivals and unresolved visits → Open visit**, then click **Confirm check-in**. There is no six-digit code to generate or enter. Staff can confirm arrival from the reservation start up to (but not including) its scheduled end. If nobody checks in by then, staff can record a no-show, or the periodic release job will do so; until it runs, the booking may still show as confirmed. Staff confirm check-out at the end of the visit.

Upgrading from the earlier code-based flow requires rebuilding **both** backend and frontend after backing up the database. Migration `1727000000000-ManualStaffCheckIn` clears outstanding codes without discarding checked-in history. Do not serve an old frontend against the new API: the student code-generation endpoint is gone. For a disposable end-to-end demonstration, see [demo data and browser smoke matrix](docs/MVP_RELEASE.md#5-demo-data).

## Demo rooms, labs, and equipment

A new database has only 4 sample resources. For demos, import 42 fictional rooms, laboratories, and equipment items in 6 buildings, with varied capacities, opening hours, approval rules, statuses, and upcoming closures:

```bash
docker compose exec backend node dist/scripts/catalog-import.js           # import
docker compose exec backend node dist/scripts/catalog-import.js --clean   # remove
```

The data is in [`web-backend/src/scripts/demo-catalog.ts`](web-backend/src/scripts/demo-catalog.ts) and the script in [`catalog-import.ts`](web-backend/src/scripts/catalog-import.ts). It is safe to rerun, never touches users or bookings, and refuses to run in production. Rebuild the backend after changing the data. Details: [demo resource catalog](docs/MVP_RELEASE.md#demo-resource-catalog).

## Development without Docker

Requires Node.js 22+. Compose still validates the backend's JWT secret when starting only PostgreSQL, so create the root `.env` first. From the repository root, start PostgreSQL in Docker, then run each app in its own terminal:

```bash
cp .env.example .env
openssl rand -base64 48   # paste into AUTH_JWT_SECRET in the root .env
docker compose up -d postgres

# Terminal 1: API
cd web-backend
npm install && cp .env.example .env
npm run migration:run
npm run start:dev

# Terminal 2: frontend
cd web-frontend
npm install && cp .env.example .env.local
npm run dev
```

Checks before opening a pull request:

```bash
(cd web-backend && npm run lint && npm test && npm run build)
(cd web-frontend && npm run lint && npm run typecheck && npm test && npm run build)
```
