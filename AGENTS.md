# AGENTS.md

## Project overview

This repository contains **Campus Resource Booking**, a deliberately simple USTH student web app for learning API calls and databases. Students sign up, log in, browse rooms, book a room for a date and time range, and cancel their own bookings.

Keep it beginner-friendly: plain code, short comments that explain the "why", and no extra layers or abstractions unless a request needs them. There are no roles, approvals, admin screens, tokens, or cookies.

## Repository layout

- `web-frontend/`: Next.js 16, React 19, TypeScript, App Router. Runs on port `18321`.
- `web-backend/`: NestJS 11, TypeORM, PostgreSQL. API runs on port `18320` under `/api`, with Swagger at `/api/docs`.
- `.pi/skills/frontend-design/SKILL.md`: project-specific USTH frontend design guidance.
- `.pi/skills/playwright-cli/SKILL.md`: project-local Microsoft Playwright CLI browser automation guidance.
- `docs/` and `progress.md`: the original project proposal and history. They describe the earlier, larger app (JWT cookies, roles, admin and staff features) and are **not** a description of the current code.

There is no root application package and no Docker Compose file. Run npm commands from the relevant subproject. Git is managed at the repository root.

## Working principles

- Read existing code before editing.
- Make the smallest coherent change that fully solves the request.
- Preserve established module boundaries and naming conventions.
- Do not edit generated output or dependencies directly: `node_modules/`, `.next/`, `dist/`, or `*.tsbuildinfo`.
- Do not create commits, push branches, or perform destructive Git operations unless explicitly requested.
- Never commit secrets, real credentials, or production data. Use `.env.example` and placeholders.
- When adding a dependency, use npm in the owning subproject, pin the requested version, and update that subproject's lockfile.
- Use sub-agents when they improve efficiency, such as independent research or separate frontend/backend work. Give each a clear, self-contained task and review its results before relying on them.

## How log in works (simple by design)

The user explicitly chose this design to practise plain POST requests. Do not add JWTs, session cookies, auth guards, or roles unless asked.

- `POST /api/auth/signup` with `{ fullName, email, password }` saves a new user and returns `{ id, email, fullName }` (201; 409 if the email is taken).
- `POST /api/auth/login` with `{ email, password }` returns the same user object (200; 401 "Invalid email or password." for a wrong password **or** an unknown email).
- The frontend remembers that user object in `localStorage` (`lib/current-user.ts`) and sends `user.id` with booking requests.
- Known trade-off: the backend trusts the `userId` it is sent, so anyone who knows a user's id can act as that user. Keep this visible in comments rather than hiding it.

## Frontend conventions

Work in `web-frontend/`.

Architecture:
- Routes and layouts live in `app/`, reusable UI in `components/`, and the API client, current-user helper, and shared types in `lib/`.
- Prefer Server Components. Add `"use client"` only when browser state, effects, event handlers, or `localStorage` require it. Anything that depends on the logged-in user is a Client Component.
- `useCurrentUser()` returns `undefined` while still checking (server render and first paint), `null` when logged out, or the user. Handle all three.
- Keep TypeScript strict. Avoid `any`; model API payloads explicitly in `lib/types.ts`.
- Follow the existing formatting style: double quotes, semicolons, and accessible semantic JSX.

API calls:
- All calls go through `request()` in `lib/api.ts`, which throws an `Error` carrying the backend's `message`. Show that message to the user rather than a generic one.
- In the browser, calls go to the same-origin `/api`. The rewrite in `next.config.ts` forwards it to `http://localhost:18320/api`, so the same build works on localhost and through the public ngrok URL.
- Server Components call the backend directly using `INTERNAL_API_URL` (default `http://localhost:18320/api`).
- Every request sends the `ngrok-skip-browser-warning` header so the ngrok free tier returns JSON.
- Only the public profile (`id`, `email`, `fullName`) may be stored in `localStorage`. Never store passwords.
- User-facing claims must reflect implemented behavior. Do not label static sample data as live or real-time.

Design and accessibility:
- For any UI creation or review, first read and follow `.pi/skills/frontend-design/SKILL.md`.
- The USTH brand foundation is fixed: royal blue `#2A3C95`, red `#EC2227`, and white. Tonal variants and restrained semantic state colors are allowed; do not replace the brand palette.
- Make campus rooms and booking the dominant visual language: rooms, buildings, capacity, dates, time slots, and statuses.
- Keep mobile task-first: log in and booking actions come before decorative content. The header must stay compact at narrow widths (see the `≤520px` rules in `app/globals.css`).
- Maintain visible keyboard focus, semantic headings and landmarks, labelled controls, sufficient contrast, readable mobile text, reduced-motion support, and accessible status/error messaging (`role="alert"` / `role="status"`).

Frontend commands:

```bash
cd web-frontend
npm install
cp .env.example .env.local   # optional; the defaults already point at localhost
npm run dev        # development on :18321
npm run build && npm run start   # production build, as used for the ngrok demo
```

Validation (there is no frontend test suite):

```bash
cd web-frontend
npm run lint
npm run typecheck
npm run build
```

After completing every feature with a user-facing interface or flow, review it with the Microsoft Playwright CLI (`playwright-cli`). Read `.pi/skills/playwright-cli/SKILL.md` before use. The review must exercise the real primary flow, not only load the page; cover representative desktop and mobile (about 390px) widths; capture snapshots and screenshots; inspect browser console errors and failed requests; check focus, keyboard access, overflow, readable control sizes, empty/error/loading states when applicable, and reduced-motion behavior; then close the named session. Sign up temporary test accounts for logged-in flows and delete those accounts and their bookings afterward, leaving real users' data untouched. Treat findings as validation failures: fix them and repeat the relevant review before reporting completion. Do not commit `.playwright-cli/` output.

## Backend conventions

Work in `web-backend/`.

Architecture:
- Organize code by feature module under `src/`: `auth/`, `users/`, `resources/`, `bookings/`, `database/`.
- Keep HTTP concerns in controllers, business rules in services, and input validation in class-validator DTOs.
- Return response DTOs such as `UserResponseDto` and `BookingResponseDto`; never serialize entities directly.
- Add Swagger decorators when adding or changing HTTP endpoints.
- Configuration is read from `.env` (`src/database/data-source.ts`, `src/main.ts`). See `web-backend/.env.example`.
- Follow the existing formatting style: single quotes, trailing commas, NestJS decorators, and dependency injection.

Rules to preserve:
- `ValidationPipe` runs with `whitelist` and `transform`. Invalid input must give a 400 with a readable message, never a 500 from the database.
- Only exact `@usth.edu.vn` addresses are accepted. Emails are trimmed and lowercased before saving or comparing.
- Passwords are hashed with Node's built-in `scrypt` (`src/auth/password.ts`, stored as `salt:hash`). The `passwordHash` column uses `select: false` and is selected only by the login check.
- Login errors must not reveal whether an email is registered.
- Duplicate sign-ups return 409, including two at the same moment (the unique email index is the final guard).
- Every booking query is scoped by `requesterId`; another user's booking returns 404.
- Bookings must not be in the past (campus time, `Asia/Ho_Chi_Minh`; the server runs in UTC) and must not overlap another **confirmed** booking for the same room. Back-to-back slots are allowed. The overlap check and insert run in one transaction with the room row locked, so simultaneous requests cannot double-book.
- CORS uses the explicit origins in `CORS_ORIGINS`.

Database rules:
- PostgreSQL migrations in `src/database/migrations/` are the schema source of truth. `synchronize` stays `false`.
- Entity changes that affect the schema require a migration.
- Review migrations before applying them. Do not drop data or reset databases without explicit approval.

Backend setup:

```bash
# PostgreSQL 16 on port 18322 (any local Postgres works; this is one option):
docker run -d --name campus-booking-postgres -p 127.0.0.1:18322:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=web_backend postgres:16-alpine

cd web-backend
npm install
cp .env.example .env   # adjust DB_NAME etc. to match your database
npm run migration:run
npm run start:dev
```

Validation (there is no backend test suite):

```bash
cd web-backend
npx tsc --noEmit -p tsconfig.json
npm run lint           # uses --fix and may modify files; inspect its changes
npm run build
```

Do not run `npm run build` while `npm run start:dev` is running: it wipes `dist/` and crashes the watch server. Use `npx tsc --noEmit` instead, or restart `start:dev` afterwards. For endpoint changes, smoke-test with `curl` against `http://localhost:18320/api`, including the error cases.

Migration commands:

```bash
npm run migration:generate -- src/database/migrations/MigrationName
npm run migration:create src/database/migrations/MigrationName
npm run migration:run
npm run migration:revert
```

## Cross-stack contract

- Backend base URL: `http://localhost:18320/api`. Frontend URL: `http://localhost:18321`.
- Endpoints:
  - `POST /auth/signup`, `POST /auth/login`
  - `GET /resources`, `GET /resources/:id`
  - `GET /bookings?userId=…`, `GET /bookings/:id?userId=…`
  - `POST /bookings` with `{ userId, resourceId, date, startTime, endTime }` (409 on overlap)
  - `PATCH /bookings/:id/cancel` with `{ userId }`
- Dates are `YYYY-MM-DD` and times are `HH:MM`.
- When changing an API contract, update the backend DTO, controller, and Swagger decorators and the frontend types, client, and UI in the same task.
- CI (`.github/workflows/ci.yml`) runs frontend lint, typecheck, and build, plus backend ESLint (without `--fix`) and build. CodeQL also runs. Keep both green.

## Definition of done

Before reporting completion:
1. Review the diff for scope, generated files, secrets, and accidental dependency changes.
2. Run type checks and lint for the affected subproject, and the build when practical.
3. For backend behavior changes, smoke-test the endpoints with `curl`, including error cases.
4. For cross-stack changes, validate both sides and smoke-test the user flow.
5. For every feature with a user-facing interface or flow, complete the Playwright CLI UI review described above and resolve its findings.
6. Report what changed, commands run, Playwright review results when applicable, and any validation that could not be completed.
