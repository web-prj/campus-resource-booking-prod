# Presentation kit

Material for a 5-minute presentation of Campus Resource Booking. The diagrams are written in [Mermaid](https://mermaid.js.org/) and render directly on GitHub and in VS Code with a Mermaid preview extension. For slides, screenshot them or paste the code into [mermaid.live](https://mermaid.live) and export PNG or SVG.

| File | Contents |
| --- | --- |
| [1-system-overview.md](1-system-overview.md) | Roles, use-case diagram, features by role, booking lifecycle, main flow |
| [2-architecture-and-api.md](2-architecture-and-api.md) | Architecture, request pipeline, data model, API tables, real-time events, performance |
| [3-screens.md](3-screens.md) | Screen map per role and wireframes of the main screens |
| [4-five-minute-script-and-qa.md](4-five-minute-script-and-qa.md) | Speaking script and questions about the current booking flow |

## 5-minute talk plan

The course asks for the app running live, not a video of it, so the talk is mostly a demo with a minute of slides. Keep one person driving and one narrating, and don't pass the laptop. The quotes are suggested wording; five minutes is about 700 spoken words.

| # | Time | On screen | Say and do |
| --- | --- | --- | --- |
| 1 | 0:00–0:30 | Landing page `/` | "Booking a room or lab at USTH means messages and spreadsheets. Two people book the same room and nobody finds out until both are standing in it. We built one system where students book, staff approve, and admins see the usage." |
| 2 | 0:30–1:30 | **Student** window: `/resources`, filter to laboratories, open *Demo Teaching Laboratory*. **Staff** window: the same lab on the same date. | Choose a future bookable date and a free hour between 08:00 and 18:00 ICT; show how the grid excludes closures and existing bookings. Book as the student (maximum three consecutive hours). It goes to *pending*, because **approval is set per resource, not per person**. If both windows are viewing the dated availability grid, the hour disappears from the other window without a manual refresh. |
| 3 | 1:30–2:15 | Staff: `/staff`, open the new request | Approve it. The student refreshes "My bookings" and sees *Confirmed*. For an optional rejection demo, seed a **separate** pending request; do not try to reject the one just approved. |
| 4 | 2:15–3:00 | Student: today's *Demo Portable Projector* booking (seeded during 08:00–22:59 ICT; bookable-hours demo only before 18:00). Staff: the same booking from the operations list | If the visit is still within its scheduled hour, the student shows the signed-in confirmation; staff match the full booking ID, student, resource and time, then click *Confirm check-in* and *Confirm check-out*. Otherwise, explain the operation using the staff screen; do not claim to have performed a live check-in. |
| 5 | 3:00–3:30 | **Admin** window: `/admin/analytics`, then `/admin/resources` | Utilization, peak hours, most-booked resources. Resources, opening hours, closures and the approval rule are all set here. |
| 6 | 3:30–4:30 | Slides: the architecture diagram ([2](2-architecture-and-api.md#the-big-picture)), the "More than CRUD" table ([1](1-system-overview.md#what-makes-it-more-than-a-crud-app)) and the performance table ([2](2-architecture-and-api.md#performance-in-one-table)) | "Next.js, NestJS and PostgreSQL in Docker Compose. Protected requests pass rate limiting, session and role checks, and input validation. Double booking is impossible, and not because of an `if`: a PostgreSQL exclusion constraint refuses overlapping bookings. We sent 100 bookings for the same slot at once, 20 times; exactly one won each time. In a synthetic mixed-read test with the rate limit raised, one API process handled about 250 requests per second; there were no errors at 800 simultaneous users, but latency grew." |
| 7 | 4:30–5:00 | The green CI run, then the wrap-up | "Lint, type checks, unit tests, PostgreSQL end-to-end tests, and a compiled Docker startup and migration check all run in CI. Thank you. Questions?" |

Rules for the run-through:

- **Rehearse twice against a freshly rebuilt stack.** Stale containers have caused demo failures before.
- If a step fails, say its sentence, show the matching diagram or wireframe, and move to the next row. Don't debug on stage.
- Animations are a bonus. Don't spend any of the five minutes on them.

## Preparing the live demo

1. Rebuild and check that every service is healthy:
   ```bash
   docker compose up -d --build   # never present a stale build
   docker compose ps              # every service "healthy"
   ```
2. Optional: load the larger demo catalog (42 resources in 6 buildings) so search looks realistic:
   ```bash
   docker compose exec backend node dist/scripts/catalog-import.js
   ```
3. **Just before the talk, preferably during 08:00–17:59 ICT**, seed the demo data. It creates a confirmed current-hour booking from 08:00 through 22:59, but the seed writes directly to the database: visits beginning at or after 18:00 are **not valid new student bookings** under the 08:00–18:00 booking window. For an accurate booking demo outside bookable hours, choose a future date and a daytime interval; for a live check-in demo, seed before 18:00. Staff can check in from the start **up to, but not including**, the scheduled end. Outside 08:00–22:59, the seed omits the check-in booking; rehearse the explanation instead. Details are in [MVP_RELEASE.md §5](../MVP_RELEASE.md#5-demo-data).
   ```bash
   cd web-backend
   # Use the local backend settings (localhost:18322 for Compose PostgreSQL).
   test -f .env || cp .env.example .env
   set -a; . ./.env; set +a
   # If the Compose database port/password/name differs from the example,
   # set DB_PORT/DB_PASSWORD/DB_NAME in web-backend/.env to match before seeding.
   DEMO_PASSWORD='choose-a-local-demo-password' npm run demo:seed
   ```
   It creates the `demo.student`, `demo.staff` and `demo.admin` accounts (all `@usth.edu.vn`, password from `DEMO_PASSWORD`), *Demo Teaching Laboratory* (needs approval), and a pending request. It directly inserts a confirmed *Demo Portable Projector* booking for the current hour only when seeded between 08:00 and 22:59 ICT; after 18:00 this seed-only visit is outside ordinary booking hours. Rerunning it resets the demo records, and `npm run demo:clean` removes them afterwards. You can use the `BOOTSTRAP_*` accounts from `.env` for staff and admin instead.
4. Sign in three sessions, **each in its own browser profile or private window**. The session is a single cookie per profile, so tabs of the same window would share one login. Put the student and staff windows side by side for row 2.
5. Screenshot every step. The brief wants the app running, so screenshots are only insurance. Other fallbacks: the wireframes in [3-screens.md](3-screens.md) and the sequence diagram in [1-system-overview.md](1-system-overview.md#main-flow-from-search-to-check-in).

## Likely questions

Security questions drawn from the course lectures, with answers, are in [COURSE_PROJECT.md §6](../COURSE_PROJECT.md#6-questions-to-expect-and-the-answer).

- **How do you stop double booking?** The API locks the resource row while booking. PostgreSQL also has an *exclusion constraint* that refuses any two slot-holding bookings that overlap on the same resource, so it holds even if the code had a bug.
- **Why a cookie instead of storing the token in browser storage?** An `httpOnly` cookie cannot be read directly by JavaScript, reducing token theft via injected scripts; it does not eliminate XSS or prevent malicious same-origin actions.
- **How is it real-time?** Socket.IO. Clients join a room for the resource and day they are viewing, and the server pushes an event when a booking changes it.
- **How fast is it?** About 250 mixed-read requests per second on one API process in a synthetic test with rate limits raised. At 800 simultaneous users, latency rose despite 0 errors. Details: [performance comparison](../benchmarks/performance-comparison.md).
- **What would you improve?** First verify the production reverse-proxy topology and complete a backup/restore drill. For scale, run several API processes with coordinated cache, rate limits and WebSocket events; add email notifications and refine the staff-confirmed arrival experience, which already requires no student-generated code.
