# Course Project Guide

What the Web Application Development course asks of the final project, how this
repository answers it, and how to present it in the five minutes we are given.

Sources: the course lecture decks (not stored in this repository) —
the project brief is in deck 5, *Front-end Frameworks*, slides 54–55; the review
checklist is in deck 9, *Authentication & Web Security*, slide 28; the
deployment expectations are in deck 10.

For how the application works, see [`ARCHITECTURE.md`](./ARCHITECTURE.md). For
slide diagrams and screen wireframes, see the
[presentation kit](./presentation/README.md).

---

## 1. What the brief actually says

**Groups and repository**

- Groups of at most 6 people, formed on the class page.
- Topics are assigned randomly from the shared spreadsheet.
- Fork the course repository and work there.
- *"Every member commits: the history is part of the grade."*
- *"Commit early, commit small, commit with a sentence."*

**What is graded**

1. A clear, friendly UI — *"readable beats clever"*.
2. Every page the assigned topic needs, and a sensible URL for each.
3. Built as components, with state where it belongs.
4. Data from an API, with **all three endings rendered** — loading, error, data.

**How it ends**

- A **5-minute presentation per group, with the app running — not a video of it**.
- Animations and polish are *"a bonus, not a substitute"*.
- *"A README that a stranger could follow to `npm run dev`."*

**On every practical, including this one**

> Used an AI assistant? Say what you asked and what you changed.

Three details in the slides are still placeholders — the fork target, the
deadline, and the topic spreadsheet link. Get those from the class page before
submission; nothing in this repository can supply them.

---

## 2. Where we stand, criterion by criterion

| Graded item                                 | Status            | Evidence                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clear, friendly UI                          | Done              | Fixed brand palette, hierarchical glass, task-first mobile layouts; reviewed with the Playwright CLI per `AGENTS.md`                                                                                                                                                                                                 |
| Every page the topic needs                  | Done              | 14 page routes: `/`, `/welcome`, `/login`, `/register`, `/dashboard`, `/resources`, `/resources/[id]`, `/bookings`, `/bookings/[id]`, `/staff`, `/staff/bookings/[id]`, `/admin/resources`, `/admin/users`, `/admin/analytics`, plus a 404 — see the route map in `ARCHITECTURE.md` §10 |
| A sensible URL for each                     | Done              | Nouns and ids: `/resources/[id]`, `/bookings/[id]`, `/staff/bookings/[id]`                                                                                                                                                                                                                                       |
| Built as components, state where it belongs | Done              | One `features/<domain>/` slice per domain; Server Components by default, `"use client"` only where state or sockets require it                                                                                                                                                                                     |
| Data from an API                            | Done              | REST endpoints documented in `ARCHITECTURE.md` §12; the frontend holds no hardcoded domain data                                                                                                                                                                                                                                                        |
| All three endings rendered                  | Done              | `app/loading.tsx`, `app/error.tsx`, plus `app/not-found.tsx`; `route-state.tsx` for in-page states                                                                                                                                                                                                            |
| README a stranger can follow                | Done              | Root `README.md`: `cp .env.example .env`, generate a secret, `docker compose up -d --build`, plus a no-Docker path                                                                                                                                                                                               |
| Tests                                       | Beyond the brief  | Backend unit and PostgreSQL E2E suites plus frontend tests, all wired into CI; see the release gate for commands                                                                                                                                                                                                                                       |
| Polish (bonus)                              | Done              | Live availability over WebSocket, live regions for screen readers, analytics                                                                                                                                                                                                                                          |
| **Every member commits**              | **Verify before submission** | Multiple human author identities appear in the `main` commit history; confirm each group member contributed before submission — see §8                                                                                                                                                                                                   |

Confirm the final submission meets the course's per-member commit requirement; the presence of multiple author identities alone does not establish that every group member contributed.

---

## 3. Our stack is not the course stack — and that is fine, if we can say why

The course taught Flask, SQLite and React on Vite. This project is NestJS,
PostgreSQL and Next.js. **The decisions are the same ones the course taught; only
the spelling changed.** Be ready to point at the line.

| The course taught                                         | Where it is in this project                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `@app.get("/api/menu/<id>")`                            | `@Get(':id')` on a Nest controller                                                 |
| `jsonify` vs `render_template`                        | Response DTOs for `/api/*`, React Server Components for page data                    |
| `error()` helper, one error shape                       | `BookingDomainError` codes mapped once per code in the controller                  |
| Status codes decided in a table                           | The refusal table in `ARCHITECTURE.md` §3                                          |
| `schema.sql` with `CHECK`, `REFERENCES`, `UNIQUE` | TypeORM entities plus versioned PostgreSQL migrations; constraints remain in the database             |
| `PRAGMA foreign_keys = ON`                              | Not needed — PostgreSQL enforces foreign keys always                                |
| Ownership in the `WHERE` clause                          | `where: { id: bookingId, requesterId }` in `bookings.service.ts`                 |
| `generate_password_hash` / `check_password_hash`      | bcrypt, cost from `AUTH_BCRYPT_ROUNDS`                                              |
| `jwt.encode` with `exp`                               | `@nestjs/jwt`, and the token goes in an `httpOnly` cookie, never a response body |
| No rate limit on login                                    | `@StrictRateLimit()`, 10 attempts per minute                                       |
| `pytest` + `app.test_client()`                        | Jest unit specs + supertest e2e against a real migrated database                     |
| `SECRET_KEY` and `DB_FILE` out of the source          | Joi-validated config; a missing `AUTH_JWT_SECRET` refuses to boot                   |
| `.env` ignored, `.env.example` committed              | Exactly that, at the repository root                                                 |
| `gunicorn --workers 4` behind nginx                     | Docker Compose; Nest and Next each in their own container, health-gated              |
| `EventSource` on `/api/events`                        | Socket.IO on `/ws`, cookie-authenticated                                            |
| `useState`, `useEffect`, `useParams`                | The same hooks, plus Server Components for the initial load                          |
| CI running your tests                                     | `.github/workflows/ci.yml`: frontend, backend, PostgreSQL e2e, compiled-container startup/migrations; CodeQL runs separately                         |

One sentence for the stage: *"We made every decision the course asked us to make
— ownership in the WHERE clause, slow hashing, a secret from the environment, one
error shape, three endings — in a framework that spells them differently."*

---

## 4. Class by class, where it shows up

| Class | Topic                                                             | In this project                                                                            |
| ----- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1     | Internet, WWW, client–server, HTTP                               | Browser → Next.js → Nest → PostgreSQL, drawn in `ARCHITECTURE.md` §1                  |
| 2     | HTML5, CSS3, semantics, accessibility, responsive                 | Semantic landmarks, labelled controls, visible focus, reduced motion, mobile-first layouts |
| 3     | ES6+, DOM, events, promises, fetch, error handling                | TypeScript throughout; `credentials: "include"` clients in `features/*/api/browser.ts`  |
| 4     | Node runtime, npm, build tooling, a first server                  | Two npm subprojects, pinned lockfiles, multi-stage Docker build                            |
| 5     | Components, props, state, routing, consuming REST                 | `features/` slices, App Router, three-ending rendering                                   |
| 6     | Routes, request handling, page vs data, status codes              | Controllers, DTOs, the refusal table                                                       |
| 7     | Relational vs document, schema design, CRUD                       | Five tables, versioned migrations, constraints in the schema — `ARCHITECTURE.md` §9            |
| 8     | RESTful design, validation, testing endpoints                     | Documented REST endpoints, `ValidationPipe` with whitelisting, e2e suites per feature                  |
| 9     | Session vs token auth, password storage, OWASP, reviewing AI code | `httpOnly` JWT cookie, bcrypt, global guards, §7 of this document                       |
| 10    | Env vars and the build, HTTPS, CI, scaling out                    | Joi config, `AUTH_COOKIE_SECURE` in production, CI, and the honest answer in §6          |

---

## 5. The five-minute presentation

The talk plan, demo setup and rehearsal rules are in the
[presentation kit](./presentation/README.md#5-minute-talk-plan), next to the
diagrams and wireframes they use. How that plan meets the brief:

- **The app runs live, not a video.** The plan gives roughly three and a half
  minutes to the demo, one minute to slides, and the final half-minute to CI and wrap-up.
- **Five minutes is about 700 spoken words**, so one person drives and one
  narrates.
- **Polish is "a bonus, not a substitute".** No time goes on animations.

---

## 6. Questions to expect, and the answer

The lecture decks state their own answers to most of these. Use theirs.

| Question                                                                     | Answer                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| *A student asks for a booking that is not theirs. 403 or 404?*             | 404. A 403 confirms the booking exists. Ours is a 404, because ownership is part of the `WHERE` clause, so the row is simply not found.                                                                                               |
| *You store passwords hashed with SHA-256 and a salt. What is still wrong?* | Speed. A salt defeats precomputed tables; it does not slow a guess down. You need a cost factor — bcrypt, which is what we use.                                                                                                       |
| *Why must both login failures look identical?*                             | Otherwise it is a username oracle: one loop tells an attacker which accounts exist before guessing a single password. Ours return the same status and the same body.                                                                   |
| *A JWT holds a user id. Is that private?*                                  | No. Base64 is encoding, not encryption; anyone holding the token reads the payload. Signed means tamper-evident. Ours carries no secrets, and the browser cannot read it anyway — it is `httpOnly`.                                  |
| *Where is the state? What is not stateless?*                               | The JWT is signed and stored in a cookie, so any backend process with the same signing key and database can serve a REST request. **Socket.IO rooms are in-process** — a second replica would need a Redis adapter. That is the honest answer, and it is the right one to give. |
| *What happens with no `AUTH_JWT_SECRET`?*                                | The app refuses to boot. Joi requires it, 32 characters minimum; there is no fallback default.                                                                                                                                         |
| *Why not put the availability check in the service layer?*                 | The service locks the resource row and turns a clash into a clear `BOOKING_OVERLAP` error, but the guarantee is a GiST exclusion constraint in PostgreSQL. A rule in the schema cannot be forgotten by a route, a colleague, or a Tuesday.                                           |
| *Show the three endings.*                                                  | Turn off the backend and reload `/resources`. `loading.tsx`, then `error.tsx`. Turn it back on for the data.                                                                                                                      |

---

## 7. The seven-question review, run against our own code

Deck 9 gives seven questions to ask of any endpoint *"whoever or whatever wrote
it"*. Here they are, answered for this codebase. Reviewers can verify each one.

| Question                                                              | This project                                                                                                                                                |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does client data enter, and is every value a parameter?         | DTOs with `class-validator`; `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`. TypeORM emits parameterized SQL; no string-built queries. |
| What happens on an empty or malformed body?                           | 400 with the offending fields named, before any handler runs.                                                                                               |
| Is there an ownership check, and is it in the `WHERE` clause?        | Yes: `where: { id: bookingId, requesterId }`. Never a check in TypeScript after the fetch.                                                                 |
| Is any verification switched off — signature, escaping, certificate? | No. JWT verification uses the configured secret with no `ignoreExpiration`; a per-socket timer also disconnects at `exp`.                                |
| Are secrets read from the environment rather than the source?         | Yes, through Joi-validated config. No feature code reads `process.env`. `.env` is gitignored.                                                            |
| Does the response distinguish failures it should not?                 | No. Login is byte-identical for an unknown email and a wrong password; a foreign booking is a 404.                                                          |
| Does any error path leak a stack trace or a database message?         | No. Domain errors map to typed codes; unexpected errors become a generic 500. Helmet is on, and `DB_LOGGING` is off by default.                            |

The deck's own warning is worth repeating in the presentation if we are asked
about AI use: *"You are accountable for the code you accept, regardless of what
produced it."*

---

## 8. Before submission

Ordered by how hard each is to fix late.

1. **Verify the commit history.** Multiple human authors now appear on `main`,
   but the brief grades contributions from *every* member. Confirm each member
   has landed real, small, described commits before the deadline.
2. **Get the three placeholders** from the class page: the fork target, the
   deadline, and the assigned topic. Confirm that "campus resource booking" is
   in fact our assigned topic before presenting it.
3. **Write the AI-assistance note.** The course asks it on every submission:
   what you asked for, and what you changed afterwards. State the tools used, the
   parts they drafted, what was rewritten, and what was reviewed with the seven
   questions in §7. Keep it factual and short; the deck's point is
   accountability, not confession.
4. **Rebuild before the demo and rehearse twice.** See §5.
5. **Run the full gate once more:**

   ```bash
   (cd web-backend  && npm run lint && npm test && npm run build && npm run test:e2e)
   (cd web-frontend && npm run lint && npm run typecheck && npm test && npm run build)
   ```
6. **Check the README from a stranger's chair.** Clone into an empty directory,
   follow it literally, and time it. That is the criterion, word for word.
