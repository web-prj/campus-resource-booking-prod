# Deployment

The default Compose setup is for local development over HTTP. This page covers what changes for a real deployment.

## Production settings

- Terminate HTTPS at a trusted reverse proxy.
- Generate the JWT secret (`openssl rand -base64 48`) and keep all secrets in the platform's secret store, not in a committed `.env`.
- Serve the frontend and API from the same site. Cross-site session cookies are unsupported until unsafe requests have CSRF protection.
- Keep PostgreSQL and the API off the public network. Compose binds both to `127.0.0.1`; put only the trusted HTTPS reverse proxy on the public interface. Do not expose the backend directly while production trusts a forwarded client address for rate limiting. Remove the PostgreSQL port mapping entirely if nothing on the host needs it.
- Replace the example `DB_PASSWORD=postgres` with a unique generated database password before initializing a production volume. Store it with the JWT secret; setting `POSTGRES_PASSWORD` after initialization does **not** rotate the existing database user—rotate it deliberately in PostgreSQL and update the application secret. Take a backup and complete a restore drill (below) before real data arrives.

At minimum, set in `.env`:

```env
NODE_ENV=production
DB_PASSWORD=<generated-unique-database-password>
AUTH_JWT_SECRET=<generated-secret-at-least-32-characters>
AUTH_COOKIE_SECURE=true
CORS_ORIGINS=https://your-frontend.example
NEXT_PUBLIC_API_URL=https://your-api.example/api
```

`NEXT_PUBLIC_API_URL` is compiled into the frontend, so rebuild after changing it: `docker compose up -d --build`. Back up the database first. Migration `1727200000000-RevokeDeactivatedSessions` adds a session version to existing users without discarding their booking history; pre-upgrade cookies lacking that claim are intentionally invalid and users must sign in again. For a release, follow the [Docker build, migration/startup and health smoke gate](MVP_RELEASE.md#4-docker-deployment-gate); CI also runs a disposable compiled-container startup and restart check.

## Upgrading from code-based check-in

The backend container runs PostgreSQL migrations **before** the API starts. Migration `1727000000000-ManualStaffCheckIn` clears outstanding six-digit codes and preserves existing arrival/checkout history. Migration `1727100000000-CheckInUntilReservationEnd` changes the no-show constraint without discarding historical early no-shows. The retired student code endpoint will not work after these migrations. Back up the database and test restoring it before upgrading (instructions below), then plan a short maintenance window so an old frontend is not served against the new API:

```bash
# From the repository root, after backing up the database:
docker compose stop frontend
docker compose up -d --build backend frontend
docker compose ps # postgres, backend, frontend must all be healthy
```

Check `docker compose logs backend` for migration or startup errors and complete the [student-to-staff browser smoke flow](MVP_RELEASE.md#6-browser-smoke-matrix). The new flow uses the student's booking confirmation and a staff-only, bodyless `PATCH /staff/bookings/:id/confirm-check-in` from the scheduled start up to (but not including) the reservation end. After that, staff can record a no-show, or the periodic release job records one for an unchecked confirmed booking and expires unreviewed requests; until then the earlier status may still hold the slot. Do not revert the manual check-in migration on a database with live check-in records: deleted codes cannot be recovered; restore from a verified pre-upgrade backup if a rollback is truly necessary.

## Built-in sample resources

Migration `1725600000000-CreateResourceCatalog` inserts 2 buildings (`MAIN`, `LAB`) and 4 resources into every database, production included: `ROOM-A101`, `ROOM-A102` (maintenance), `LAB-L201`, and `EQUIP-PROJ-01`.

Do not edit or remove this migration; it has already run against existing databases and the e2e tests rely on it. To keep these resources out of production, an administrator can set them to **inactive** in the admin resource screen. That is refused while a resource still has active bookings.

The separate demo catalog (`npm run catalog:import`) is for demonstrations only and refuses to run with `NODE_ENV=production`.

## Backup and restore

Back up with a logical `pg_dump` archive rather than copying the Docker volume:

```bash
set -a; . ./.env; set +a
mkdir -p backups
backup="backups/campus-resource-booking-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose exec -T postgres pg_dump \
  --username "${DB_USERNAME:-postgres}" --dbname "${DB_NAME:-web_backend}" \
  --format custom --no-owner --no-privileges > "$backup"

test -s "$backup"
```

Move the archive to encrypted storage off the host. A backup only counts once it restores, so test it into a temporary database, never over the live one:

```bash
restore_db="${DB_NAME:-web_backend}_restore_test"
u="${DB_USERNAME:-postgres}"

docker compose exec -T postgres dropdb --if-exists --username "$u" "$restore_db"
docker compose exec -T postgres createdb --username "$u" "$restore_db"
docker compose exec -T postgres pg_restore --username "$u" --dbname "$restore_db" \
  --no-owner --no-privileges < "$backup"
docker compose exec -T postgres psql --username "$u" --dbname "$restore_db" \
  --command 'SELECT count(*) AS applied_migrations FROM migrations;'

# Remove only the temporary restore target afterwards.
docker compose exec -T postgres dropdb --username "$u" "$restore_db"
```

For a real recovery: stop writes, restore into a new database, check migrations and key row counts, point the backend at it, and smoke-test the main flows ([release checklist](MVP_RELEASE.md)) before reopening traffic. Never restore over the only copy, run `migration:revert`, or delete the original volume during recovery.
