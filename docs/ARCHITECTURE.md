# Campus Resource Booking — Architecture

How the application actually works, told as the flows a real user walks through.
Each of the first sections is one flow: a picture, then the rules the server
applies during it. Structure, data, and reference tables come afterwards,
because they only make sense once you have seen what they serve.

For the course brief and the grading checklist, see
[`COURSE_PROJECT.md`](./COURSE_PROJECT.md); for the talk, the
[presentation kit](./presentation/README.md). Product scope is in the
[proposal](./Campus_Resource_Booking_Project_Proposal_EN.docx); contributor
rules are in [`../AGENTS.md`](../AGENTS.md).

**What it is.** A USTH web application for booking rooms, laboratories, and
equipment. Students search and reserve; staff approve requests and run check-in
and check-out; admins manage accounts, resources, and analytics.

| Part     | Technology                                                    |
| -------- | ------------------------------------------------------------- |
| Frontend | Next.js 16, React 19, App Router — `http://localhost:18321` |
| Backend  | NestJS 11, TypeORM — `http://localhost:18320/api`           |
| Database | PostgreSQL 16                                                 |
| Realtime | Socket.IO, namespace `/ws`                                   |

---

## 1. The whole system in one picture

One `compose.yaml` builds and runs all three services from a single multi-stage
`Dockerfile`. Startup is ordered by health checks, not timers: PostgreSQL must
answer a real query before the backend starts, and the backend must pass
`/api/health` before the frontend starts.

```mermaid
flowchart LR
    browser["Browser"]

    subgraph host["Host machine"]
        subgraph compose["Docker Compose: campus-resource-booking"]
            fe["frontend<br/>Next.js standalone<br/>:18321"]
            be["backend<br/>NestJS + Socket.IO<br/>:18320/api"]
            db[("postgres<br/>postgres:16-alpine")]
            vol[("volume<br/>postgres_data")]
        end
    end

    browser -->|"HTTP :18321"| fe
    browser -->|"fetch, credentials include"| be
    browser -->|"WebSocket /ws, session cookie"| be
    fe -->|"Server Components<br/>INTERNAL_API_URL"| be
    be -->|"TypeORM, pg"| db
    db --- vol

    classDef svc fill:#2A3C95,stroke:#1d2a68,color:#fff
    classDef store fill:#f3f4f8,stroke:#2A3C95,color:#1d2a68
    class fe,be svc
    class db,vol store
```

Two boundary details explain most of the confusion when reading the code:

- **There are two API base URLs.** Browser code uses `NEXT_PUBLIC_API_URL`,
  baked in at `next build` time. Server Components use `INTERNAL_API_URL`
  (`http://backend:18320/api`) to stay on the Compose network.
- **Migrations run at container start.** The backend command runs
  `typeorm migration:run` and only then `node dist/main`, so the schema is
  current before any traffic is accepted.

---

## 2. Flow 1 — Signing in

Normalized USTH email → verified credentials → `httpOnly` cookie → credentialed
requests. The token never appears in a response body and is never readable from
JavaScript.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant F as Next.js server
    participant A as AuthController
    participant P as PostgreSQL

    B->>A: POST /api/auth/login
    Note over A: Public route, 10 attempts per minute
    A->>P: SELECT user, password_hash explicitly selected
    P-->>A: row or none
    A->>A: bcrypt compare, one message for every failure
    A-->>B: Set-Cookie access_token, httpOnly, SameSite, Secure in production

    B->>F: GET /dashboard
    F->>A: GET /api/auth/me, cookie forwarded
    A-->>F: UserResponseDto
    F-->>B: page rendered for that role

    B->>A: GET /api/bookings/mine, credentials included
    A-->>B: the student's timeline
```

- Registration creates **students only**. The first admin and staff accounts come
  from `BOOTSTRAP_*` variables and are provisioned at backend startup by
  `AccountBootstrapService`. Existing passwords and roles are never modified;
  only an existing inactive admin may be reactivated if no active admin remains.
  Self-registered student accounts cannot become admin through bootstrap.
- Later staff accounts are created by an admin (`POST /admin/users`) with an
  initial password. There is no endpoint that changes a role: an account keeps
  the role it was created with.
- Only exact `@usth.edu.vn` addresses pass the auth DTOs.
- `password_hash` is `select: false`; it is read only to verify a password.
- A wrong password and an unknown email return the same status and the same body.
- Deactivation (and bootstrap reactivation of an inactive admin) increments
  `session_version`. REST and WebSocket authentication reject an older cookie
  even if the account is later reactivated; pre-migration
  cookies without the version must be replaced by signing in again.
- Redirects after login pass through `getSafeRedirect`, which rejects
  protocol-relative, external, backslash, and control-character paths.

---

## 3. Flow 2 — Finding a resource and booking it

The decisive rule: **whether a booking needs approval is a property of the
resource, not of the person**. A bookable room auto-confirms; a teaching
laboratory (`requires_approval = true`) enters the staff queue.

```mermaid
sequenceDiagram
    autonumber
    participant S as Student
    participant N as Next.js server
    participant R as ResourcesController
    participant BC as BookingsController
    participant DB as PostgreSQL

    S->>N: GET /resources with type and building filters
    N->>R: GET /api/resources
    R-->>N: one page of resources
    N-->>S: discovery list, in one of three states

    S->>N: GET /resources/:id
    N->>R: GET /api/resources/:id/availability?date=YYYY-MM-DD
    R->>DB: operating hours, closures, active bookings
    R-->>N: the free hour slots only, booked hours left out
    N-->>S: availability grid

    S->>BC: POST /api/bookings with resource, date, start, end
    BC->>DB: BEGIN, lock resource row, insert, exclusion constraint checked
    alt the slot is still free
        DB-->>BC: row committed
        BC-->>S: 201, pending or confirmed
    else another booking landed first
        DB-->>BC: exclusion violation
        BC-->>S: 409 BOOKING_OVERLAP
    end
```

What the server refuses, and with which code:

| Code                                                                                  | HTTP | Meaning                                                          |
| ------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `INVALID_BOOKING_DATE`, `INVALID_BOOKING_RANGE`, `BOOKING_IN_PAST`              | 400  | Slot malformed or already past                                   |
| `RESOURCE_NOT_FOUND`, `BOOKING_NOT_FOUND`                                         | 404  | Unknown target, or not yours                                     |
| `RESOURCE_UNAVAILABLE`                                                              | 409  | Closed day, outside operating hours, or resource not operational |
| `BOOKING_OVERLAP`                                                                   | 409  | Another active booking covers the slot                           |
| `BOOKING_NOT_PENDING`, `BOOKING_REVIEW_WINDOW_ENDED`                              | 409  | No longer reviewable                                             |
| `BOOKING_NOT_CANCELLABLE`                                                           | 409  | Outside the cancellation window                                  |
| `CHECK_IN_NOT_AVAILABLE`                                                         | 409  | Booking is not confirmed or is outside the staff check-in window |
| `BOOKING_NOT_CHECKED_IN`, `NO_SHOW_NOT_AVAILABLE`                                 | 409  | Checkout or no-show preconditions unmet                          |

Each is a typed `BookingDomainError` raised in `bookings.service.ts` and mapped
to a status in the controller — one place per code, rather than a scatter of
`throw new BadRequestException` across the codebase.

---

## 4. Flow 3 — Approval, and the whole lifecycle

Staff open the pending queue, read the request, and approve or reject it with a
reason. Everything a booking can ever do is in this one picture.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> pending: POST /bookings, resource requires approval
    [*] --> confirmed: POST /bookings, no approval needed

    pending --> confirmed: staff approve
    pending --> rejected: staff reject with reason
    pending --> cancelled: student cancel
    pending --> expired: unreviewed after end; release job

    confirmed --> checked_in: staff match confirmation and record arrival
    confirmed --> no_show: unchecked after end; staff or release job
    confirmed --> cancelled: student cancel while eligible

    checked_in --> completed: staff check out

    rejected --> [*]
    cancelled --> [*]
    completed --> [*]
    no_show --> [*]
    expired --> [*]

    note right of confirmed
        The student sees booking confirmation in their account.
        Status stays confirmed until staff record arrival.
    end note
```

Every write takes a row lock and re-reads the status inside the transaction, so
two staff members clicking *Approve* on the same request cannot both succeed —
the second one gets `BOOKING_NOT_PENDING`. Each actor column is a separate
foreign key to `users`, so the row records *who* approved, checked in, checked
out, or flagged a no-show, and when.

---

## 5. Flow 4 — Check-in and check-out

Students show the confirmed booking in their signed-in account. Staff compare its full booking reference, student, resource and time with the live staff record before recording arrival. The student cannot mark themselves checked in; a screenshot alone is not proof of a current booking.

```mermaid
sequenceDiagram
    autonumber
    participant S as Student
    participant API as API
    participant T as Staff

    S->>API: GET /bookings/mine/:id
    API-->>S: confirmed booking details in account
    S->>T: shows booking confirmation at the door
    T->>API: GET /staff/bookings/:id; compare identity, reference, resource, time
    T->>API: PATCH /staff/bookings/:id/confirm-check-in
    alt booking still confirmed and inside check-in window
        API-->>T: status checked_in; staff actor/time recorded
    else booking no longer eligible
        API-->>T: 409 CHECK_IN_NOT_AVAILABLE
    end
    T->>API: PATCH /staff/bookings/:id/check-out
    API-->>T: status completed
```

Check-in opens at the scheduled start and closes at the reservation end
(the end instant is excluded), as does the review window for a pending request.
After that deadline `BookingReleaseScheduler` closes unused bookings: it runs
`releaseMissedDeadlines()` every `BOOKING_RELEASE_INTERVAL_SECONDS` (60 by
default), which marks a confirmed booking staff have not checked in as
`no_show` with no staff actor, and a request nobody reviewed as `expired`.
Showing the confirmation without staff recording arrival does not prevent a
no-show. Until the scheduled update is persisted, an overdue booking can remain
confirmed or pending and may still hold the slot. Staff can also record a no-show
from the scheduled end. The update is
idempotent, so several API processes running it is harmless. Analytics excludes
automatically released no-shows from demand figures.

---

## 6. Flow 5 — Availability updating live

A second browser sees a slot disappear without pressing refresh. The WebSocket
handshake is authenticated from the same session cookie as REST.

```mermaid
sequenceDiagram
    autonumber
    participant S as Student B
    participant G as EventsGateway
    participant A as Student A
    participant API as BookingsService
    participant EV as AvailabilityEventsService

    S->>G: connect with access_token cookie
    G->>G: verify JWT, load user, require active account
    G->>G: join user room, schedule expiry timer
    S->>G: subscribe with resourceId and date
    A->>API: POST /api/bookings
    API->>API: commit the transaction
    API->>EV: notifyAvailabilityChanged
    EV->>G: emit into the availability room
    G-->>S: availability changed
    S->>S: revalidate slots, announce in a live region
```

| Concern            | Implementation                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Rooms              | `user:<id>`, `availability:<resourceId>:<date>`, `dashboard:availability:<date>`   |
| Events out         | `availability:changed`, `resource:changed`                                           |
| Limits             | 20 availability rooms and 20 dashboard rooms per socket                                  |
| Payload validation | `resourceId` a UUID, `date` a real `YYYY-MM-DD` — the same rules as the REST DTOs |
| CORS               | `ConfigIoAdapter`, from the same validated origin allowlist as HTTP                    |
| Token expiry       | A per-socket timer disconnects at `exp`                                                 |
| Deactivation       | `UserAccessEvents.deactivated$` drops every socket in that user's room                 |

Emitted by every booking write (create, approve, reject, confirm check-in, check
out, no-show, cancel), by the missed check-in release, and by every resource
change (edit, status, closure). Pushes
reach assistive technology through `dashboard-live-region` and
`availability-live-region`, so availability never moves silently.

---

## 7. The five flows as one journey

The same story end to end: an admin defines what exists, a student asks for a
slot, PostgreSQL decides whether the slot is free, the resource's own approval
rule decides who has to say yes, attendance decides how it finishes, and every
one of those writes pushes back into the availability every other browser is
looking at.

```mermaid
flowchart LR
    subgraph setup["Admin sets the stage"]
        adm["Buildings, resources,<br/>opening hours,<br/>approval rule, closures"]
    end

    subgraph ask["Student asks"]
        find["Find a resource<br/>filters, availability grid"]
        submit["Submit a booking"]
        free{"Slot still free?<br/>decided by PostgreSQL"}
        clash["409 BOOKING_OVERLAP"]
        needs{"Resource requires<br/>approval?"}
    end

    subgraph decide["Staff decides"]
        pending["pending"]
        queue["Approval queue"]
        review{"Review"}
    end

    subgraph attend["The slot arrives"]
        confirmed["confirmed"]
        arrive{"Student turns up?"}
        verify["Booking and identity<br/>matched by staff"]
        checkedin["checked_in"]
        out["Staff checks out"]
    end

    subgraph done["It ends one of five ways"]
        rejected(["rejected"])
        expired(["expired"])
        cancelled(["cancelled"])
        noshow(["no_show"])
        completed(["completed"])
    end

    signin["Sign in<br/>httpOnly cookie"] --> find
    adm -.->|"defines what can be booked"| find

    find --> submit --> free
    free -->|no| clash --> find
    free -->|yes| needs
    needs -->|"yes, a laboratory"| pending --> queue --> review
    needs -->|"no, a room"| confirmed
    review -->|approve| confirmed
    review -->|"reject with a reason"| rejected
    review -->|"nobody decides by scheduled end"| expired

    confirmed --> arrive
    arrive -->|"cancels first"| cancelled
    arrive -->|"not checked in by scheduled end"| noshow
    arrive -->|yes| verify --> checkedin --> out --> completed

    pending -.-> push
    confirmed -.-> push
    checkedin -.-> push
    push(["availability changed,<br/>pushed over Socket.IO"]) -.-> find

    done --> ana["Admin analytics:<br/>utilization, status mix, no-show rate"]

    classDef act fill:#2A3C95,stroke:#1d2a68,color:#fff
    classDef st fill:#f3f4f8,stroke:#2A3C95,color:#1d2a68
    classDef fin fill:#EC2227,stroke:#b5171b,color:#fff
    classDef live fill:#3d51b5,stroke:#1d2a68,color:#fff
    class signin,adm,find,submit,queue,verify,out,ana act
    class pending,confirmed,checkedin st
    class rejected,expired,cancelled,noshow,completed fin
    class push,clash live
    classDef phase fill:#f7f8fc,stroke:#c9cfe8,color:#1d2a68
    class setup,ask,decide,attend,done phase
```

Reading it against the rest of this document: signing in is §2, *Find a
resource* through to `pending` or `confirmed` is §3, the staff panel is §4, the
staff confirmation and checkout are §5, and the dotted arrows back to *Find* are §6.

Dark boxes are actions, and each one is an HTTP call that went through the
pipeline in the next section. Pale boxes are the `status` value on a row in
`bookings`. Red boxes are the four states a booking can never leave. Analytics
reads every status, in flight or finished, not just the terminal ones.

---
## 8. What every request passes through

The same pipeline runs for all of the flows above, in this order. It is
registered globally in `app.setup.ts` (middleware, CORS, validation) and
`app.module.ts` (the three guards), so it cannot be forgotten on a new route.

```mermaid
flowchart LR
    req["Request"] --> ck["cookie-parser"]
    ck --> helmet["helmet<br/>security headers"]
    helmet --> cors["CORS<br/>explicit origins, credentials"]
    cors --> thr["ThrottlerGuard<br/>global, or 10/min on auth"]
    thr --> jwt["JwtAuthGuard<br/>global unless Public"]
    jwt --> roles["RolesGuard<br/>Roles decorator"]
    roles --> vp["ValidationPipe<br/>whitelist, transform"]
    vp --> ctl["Controller, Service, TypeORM"]
    ctl --> dto["Response DTO<br/>never a raw entity"]

    classDef g fill:#EC2227,stroke:#b5171b,color:#fff
    class thr,jwt,roles g
```

Rate limit, then authenticate, then authorize — so an unauthenticated flood is
rejected before it can reach the database. The consequences worth preserving:

- Authentication is **global**. A route added tomorrow is protected unless it is
  explicitly marked `@Public()`; forgetting the decorator fails closed.
- Authorization is **declarative**: `@Roles('staff', 'admin')`. There are no ad
  hoc role checks inside controller bodies.
- Ownership is enforced **in the query**, not after it:
  `where: { id: bookingId, requesterId }`. A student asking for someone else's
  booking gets a 404, which reveals nothing about whether it exists.
- Responses are DTOs, so an internal column cannot leak by accident.
- Configuration is validated by Joi at boot (`config/env.validation.ts`) and
  reaches feature code only through typed namespaces. Nothing reads
  `process.env` directly, and a missing `AUTH_JWT_SECRET` stops the app rather
  than falling back to a default.

| Role               | Reaches                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------ |
| public             | `POST /auth/register`, `POST /auth/login`, `GET /health`                             |
| any signed-in user | `GET /auth/me`, `POST /auth/logout`, resource discovery and availability               |
| student            | `POST /bookings`, `/bookings/mine/*`                                                   |
| staff              | `/staff/bookings/*`                                                                      |
| admin              | everything staff reaches, plus `/admin/users`, `/admin/resources`, `/admin/analytics` |

---

## 9. The data behind the flows

Five tables. Migrations are the schema source of truth
(`DB_SYNCHRONIZE=false`); apply them in timestamp order.

```mermaid
erDiagram
    USERS ||--o{ BOOKINGS : requests
    USERS ||--o{ BOOKINGS : reviews
    BUILDINGS ||--o{ RESOURCES : houses
    RESOURCES ||--o{ RESOURCE_CLOSURES : closed_on
    RESOURCES ||--o{ BOOKINGS : reserved_by

    USERS {
        uuid id PK
        varchar email UK "exact usth.edu.vn address"
        varchar password_hash "select false"
        varchar full_name
        enum role "student, staff, admin"
        boolean is_active
        int session_version "revokes earlier cookies"
    }

    BUILDINGS {
        uuid id PK
        varchar code UK
        varchar name
        varchar address
    }

    RESOURCES {
        uuid id PK
        varchar code UK
        varchar name
        enum type "room, laboratory, equipment"
        enum status "operational state"
        integer capacity "1 to 10000"
        text_array amenities
        boolean requires_approval
        int_array operating_days "1 to 7"
        time opens_at "whole hour"
        time closes_at "whole hour, after opens_at"
        uuid building_id FK
    }

    RESOURCE_CLOSURES {
        uuid id PK
        uuid resource_id FK
        date date "unique per resource"
        varchar reason
    }

    BOOKINGS {
        uuid id PK
        uuid resource_id FK
        uuid requester_id FK
        date booking_date
        time start_time "whole hour"
        time end_time "whole hour, at or before 23:00"
        enum status "eight states"
        tsrange booking_period "generated, stored"
        timestamptz reviewed_at
        uuid reviewed_by_id FK
        text rejection_reason
        varchar check_in_code "legacy, must be null"
        timestamptz checked_in_at
        uuid checked_in_by_id FK
        timestamptz checked_out_at
        uuid checked_out_by_id FK
        timestamptz no_show_at
        timestamptz cancelled_at
    }
```

Correctness is pushed down into PostgreSQL rather than trusted to application
code alone:

- **Double booking is physically impossible.** A GiST exclusion constraint over
  `(resource_id WITH =, booking_period WITH &&)`, filtered to
  `status IN ('pending','confirmed','checked_in')`. `booking_period` is a
  generated stored `tsrange`. This — not a service-layer check — is what raises
  the 409 in Flow 2.
- **Status and columns cannot disagree.** About a dozen `CHECK` constraints: a
  `rejected` row must carry `reviewed_at` and a non-empty reason; a
  `checked_in` row must carry `checked_in_at` and `checked_in_by_id`; a
  `pending` row must be unreviewed; new check-ins do not require a student-generated code or request timestamp.
- **Schedules are sane by construction:** `start_time < end_time`, whole hours,
  `end_time <= 23:00`, operating days non-empty and within `1..7`.
- **History cannot be orphaned.** Every foreign key on `bookings` is
  `ON DELETE RESTRICT`.

Partial indexes back the hot reads: the pending queue, the operations board,
per-resource day lookups, and the analytics rollup.

All times are campus time, ICT `UTC+07:00`, through one injectable
`CAMPUS_CLOCK` token (`common/time/campus-clock.ts`) — so tests can freeze the
clock and nothing computes "today" from the server's locale.

---

## 10. Pages and URLs

Protected pages resolve the session on the server and redirect *before*
rendering, so protected markup is never sent to an unauthorized visitor.
`/dashboard` is the role dispatcher.

```mermaid
flowchart TD
    root["/<br/>public landing page"] --> login["/login<br/>next parameter, safe paths only"]
    root --> register["/register"]

    login --> dash{"/dashboard<br/>role dispatch"}
    register --> dash
    welcome["/welcome<br/>redirects to /dashboard"] -.-> dash
    dash -->|student| sdash["/dashboard<br/>student workspace"]
    dash -->|staff| staff["/staff<br/>approvals and operations"]
    dash -->|admin| ares["/admin/resources"]

    sdash --> resources["/resources<br/>discovery, filters, paging"]
    resources --> rdetail["/resources/[id]<br/>availability and booking form"]
    sdash --> bookings["/bookings<br/>student ledger"]
    bookings --> bdetail["/bookings/[id]"]

    staff --> sbdetail["/staff/bookings/[id]<br/>review, check-in, checkout"]

    ares --> ausers["/admin/users"]
    ares --> aana["/admin/analytics"]

    noauth["No session"] -.->|redirect to login with next| login

    classDef pubn fill:#f3f4f8,stroke:#2A3C95,color:#1d2a68
    classDef stun fill:#2A3C95,stroke:#1d2a68,color:#fff
    classDef stfn fill:#3d51b5,stroke:#1d2a68,color:#fff
    classDef admn fill:#EC2227,stroke:#b5171b,color:#fff
    class root,welcome,login,register pubn
    class sdash,resources,rdetail,bookings,bdetail stun
    class staff,sbdetail stfn
    class ares,ausers,aana admn
```

Every data-loading route renders three outcomes, never one: `app/loading.tsx`
while it waits, `app/error.tsx` when the fetch fails, and the content when it
arrives — plus `app/not-found.tsx` for unknown URLs. If a session expires
between the user lookup and the data fetch, `withSessionRedirect` sends the
visitor to sign in and then back to the same route, instead of to a generic
error boundary.

The brand foundation is fixed — royal blue `#2A3C95`, red `#EC2227`, white —
with glassmorphism applied hierarchically and mobile layouts task-first.
Details: [`../.pi/skills/frontend-design/SKILL.md`](../.pi/skills/frontend-design/SKILL.md).

---

## 11. Where the code lives

```text
.
├── compose.yaml            # postgres + backend + frontend, health-gated
├── Dockerfile              # 4 stages, 2 runtime targets
├── web-backend/
│   └── src/
│       ├── auth/           # login, register, guards, bootstrap accounts
│       ├── users/          # accounts and admin user management
│       ├── resources/      # buildings, resources, closures, availability
│       ├── bookings/       # the lifecycle: student, staff, analytics
│       ├── events/         # Socket.IO gateway and availability events
│       ├── common/         # decorators, guards, validators, campus clock
│       ├── config/         # Joi env validation, typed namespaces
│       ├── database/       # migrations, the schema source of truth
│       └── scripts/        # demo seed, catalog import, benchmark
├── web-frontend/
│   ├── app/                # routes, layouts, loading/error/not-found
│   ├── features/           # one slice per domain, see below
│   ├── components/         # shared UI: header, glass panel, ribbons
│   └── lib/                # api config, session, realtime client
└── docs/                   # proposal, this document, course guide, runbooks
```

Every `features/<domain>/` slice has the same shape, which is the main thing to
know before adding a feature:

| Path                        | Holds                                                             |
| --------------------------- | ----------------------------------------------------------------- |
| `api/server.ts`           | Server Component fetchers, via `INTERNAL_API_URL`                |
| `api/browser.ts`          | Client fetchers, `credentials: "include"`                        |
| `schema.ts`, `types.ts` | Parse and model the API payload explicitly                        |
| `components/`             | The slice's UI — Server Components unless state forces otherwise |

Backend modules follow the matching rule: HTTP concerns in controllers, business
rules in services, validation in DTOs, shared pieces in `common/`. A service
never reads `process.env`; an entity change never ships without a migration.

---

## 12. Reference

### API surface

Relative to `http://localhost:18320/api`. Swagger UI: `/api/docs`.

| Method     | Path                                               | Access               | Purpose                                   |
| ---------- | -------------------------------------------------- | -------------------- | ----------------------------------------- |
| `GET`    | `/health`                                        | public               | Liveness and database probe               |
| `POST`   | `/auth/register`                                 | public, strict limit | Create a student account, start a session |
| `POST`   | `/auth/login`                                    | public, strict limit | Exchange credentials for a cookie         |
| `POST`   | `/auth/logout`                                   | authenticated        | Clear the cookie                          |
| `GET`    | `/auth/me`                                       | authenticated        | Current user                              |
| `GET`    | `/resources`                                     | authenticated        | Discover active resources; date alone finds resources free for their entire operating day (only if it has not started), while date + startTime + endTime searches a specific interval |
| `GET`    | `/resources/buildings`                           | authenticated        | Buildings for filters                     |
| `GET`    | `/resources/:id`                                 | authenticated        | One active resource                       |
| `GET`    | `/resources/:id/availability`                    | authenticated        | Bookable slots for a date                 |
| `POST`   | `/bookings`                                      | student              | Create a booking request                  |
| `GET`    | `/bookings/mine`                                 | student              | Upcoming and history                      |
| `GET`    | `/bookings/mine/:id`                             | student              | One own booking                           |
| `PATCH`  | `/bookings/mine/:id/cancel`                      | student              | Cancel while eligible                     |
| `GET`    | `/staff/bookings/pending`                        | staff, admin         | Approval queue                            |
| `GET`    | `/staff/bookings/operations`                     | staff, admin         | Today's operations board                  |
| `GET`    | `/staff/bookings/resources/:resourceId/schedule` | staff, admin         | One resource's day                        |
| `GET`    | `/staff/bookings/:id`                            | staff, admin         | Booking detail for review                 |
| `PATCH`  | `/staff/bookings/:id/approve`                    | staff, admin         | Approve, until the scheduled end     |
| `PATCH`  | `/staff/bookings/:id/reject`                     | staff, admin         | Reject with a reason                      |
| `PATCH`  | `/staff/bookings/:id/confirm-check-in`           | staff, admin         | Confirm arrival after matching booking    |
| `PATCH`  | `/staff/bookings/:id/check-out`                  | staff, admin         | Complete a checked-in booking             |
| `PATCH`  | `/staff/bookings/:id/no-show`                    | staff, admin         | Flag a booking that missed check-in       |
| `GET`    | `/admin/users`                                   | admin                | Search and list accounts                  |
| `POST`   | `/admin/users`                                   | admin                | Create a staff account                    |
| `PATCH`  | `/admin/users/:id/status`                        | admin                | Activate or deactivate                    |
| `GET`    | `/admin/resources`                               | admin                | List for administration                   |
| `GET`    | `/admin/resources/buildings`                     | admin                | Buildings available                       |
| `POST`   | `/admin/resources`                               | admin                | Create a resource                         |
| `PATCH`  | `/admin/resources/:id`                           | admin                | Edit a resource                           |
| `PATCH`  | `/admin/resources/:id/status`                    | admin                | Change operational status                 |
| `GET`    | `/admin/resources/:id/closures`                  | admin                | List closure dates                        |
| `POST`   | `/admin/resources/:id/closures`                  | admin                | Close for a date                          |
| `DELETE` | `/admin/resources/:id/closures/:closureId`       | admin                | Remove a closure                          |
| `GET`    | `/admin/analytics`                               | admin                | Booking and utilization analytics         |

Swagger decorators are part of the definition of done for any endpoint change.

### Configuration

| Group            | Variables                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ports and URLs   | `BACKEND_PORT`, `FRONTEND_PORT`, `DB_HOST_PORT`, `NEXT_PUBLIC_API_URL`, `INTERNAL_API_URL`, `CORS_ORIGINS`                                                     |
| Database         | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_SYNCHRONIZE`, `DB_LOGGING`                                                                |
| Auth             | `AUTH_JWT_SECRET` (32+ characters, required), `AUTH_TOKEN_EXPIRES_IN`, `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SAME_SITE`, `AUTH_COOKIE_SECURE`, `AUTH_BCRYPT_ROUNDS` |
| Rate limits      | `THROTTLE_TTL`, `THROTTLE_LIMIT`, `AUTH_THROTTLE_LIMIT`                                                                                                              |
| Bookings         | `BOOKING_RELEASE_INTERVAL_SECONDS` (60; 0 turns off automatic end-of-reservation cleanup)                                                                                    |
| Startup accounts | `BOOTSTRAP_ADMIN_*`, `BOOTSTRAP_STAFF_*`                                                                                                                               |
| Runtime          | `NODE_ENV`, `API_PREFIX`, `DOCKER_SUBNET`                                                                                                                            |

Real environment variables always beat `.env` files, so a deployed container
ignores them. `.env` is gitignored; `.env.example` holds placeholders only.

### Commands

```bash
# Whole stack
cp .env.example .env && openssl rand -base64 48   # paste into AUTH_JWT_SECRET
docker compose up -d --build
docker compose logs -f backend

# Validation
(cd web-backend  && npm run lint && npm test && npm run build)
(cd web-frontend && npm run lint && npm run typecheck && npm test && npm run build)
(cd web-backend  && npm run test:e2e)             # needs a migrated database

# Migrations
(cd web-backend && npm run migration:run)
(cd web-backend && npm run migration:generate -- src/database/migrations/Name)

# Demo data
(cd web-backend && DEMO_PASSWORD='...' npm run demo:seed)   # demo.* accounts
docker compose exec backend node dist/scripts/catalog-import.js
```

CI (`.github/workflows/ci.yml`) runs a frontend job (lint, typecheck, vitest,
`next build`), a backend job (lint, unit tests, build), a backend E2E job
against a PostgreSQL service container, and CodeQL. The E2E job also checks the
**latest migration** can be reverted and reapplied on its disposable database — it
runs `migration:revert` and then `migration:run` again. Earlier lifecycle
migrations may refuse rollback when live history would be lost. A broken
latest `down()` fails CI rather than surfacing during a rollback.

### Related documents

| Document                                                                                                  | Covers                                                                |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`COURSE_PROJECT.md`](./COURSE_PROJECT.md)                                                               | Course brief, grading checklist, likely questions                     |
| [`MVP_RELEASE.md`](./MVP_RELEASE.md)                                                                     | Release runbook: quality gate, migration gate, smoke matrix, rollback |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md)                                                                       | Production settings, sample resources, backup and restore             |
| [`benchmarks/availability-query-benchmark.md`](./benchmarks/availability-query-benchmark.md)             | Availability-query benchmark method and recorded results              |
| [`benchmarks/performance-comparison.md`](./benchmarks/performance-comparison.md)                         | Load and stress test results, before/after comparisons                |
| [`presentation/README.md`](./presentation/README.md)                                                     | Presentation kit: talk plan, diagrams, screen wireframes              |
| [`Campus_Resource_Booking_Project_Proposal_EN.docx`](./Campus_Resource_Booking_Project_Proposal_EN.docx) | Product scope and proposal                                            |
