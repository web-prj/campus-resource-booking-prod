# web-frontend

Next.js 16 (React 19, App Router) interface for Campus Resource Booking: search and live availability, booking confirmations for students, approvals and check-in/out for staff, and resource, user, and analytics management for admins.

## Run locally

Start the API first ([web-backend](../web-backend/README.md)), then:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:18321. To run everything in Docker instead, see the [root README](../README.md).

## How it connects to the API

- Browser requests go to `NEXT_PUBLIC_API_URL` (default `http://localhost:18320/api`) with `credentials: "include"`. The value is compiled in, so rebuild after changing it.
- Server Components use `INTERNAL_API_URL` when set (Docker uses `http://backend:18320/api`) and forward the user's cookie.
- The session token lives only in an `httpOnly` cookie; frontend code never reads or stores it. Deactivation invalidates earlier cookies even after reactivation; existing users must sign in again after the session-version migration. An `httpOnly` cookie reduces direct token theft but does not eliminate XSS.

## Search and availability

Choose a date with **Any start** and **Any end** to find resources free for their entire operating day, provided that day has not begun. To search part of a day, choose both **From** and **Until**. The dated resource view lets students choose up to three consecutive free hours between 08:00 and 18:00 ICT, subject to the resource's operating schedule. The student dashboard shows availability for up to three active resources, with horizontally scrollable operating-hour bands and a keyboard-accessible timeline when needed. Booking and resource changes notify connected views to refresh; the API remains authoritative.

## Booking confirmation and arrival

A confirmed booking appears under **My bookings → View details** with the student's name, university email, full booking ID, resource, location, date, and time. A pending request is not a confirmation; wait for staff approval first. The student shows the confirmation in their signed-in account at the resource. Staff compare those details with their own live booking record and use **Confirm check-in** in the staff view. There is no check-in code and the student cannot check themselves in. Staff can confirm from the reservation start up to (but not including) its scheduled end. After that, an unchecked booking becomes a no-show when staff record it or the periodic release job runs; until then it can still appear confirmed. Staff record checkout for checked-in visits.

## Code layout

- `app/`: routes and layouts
- `features/`: UI and logic per area (auth, resources, bookings, dashboard, users, analytics)
- `components/`: shared UI
- `lib/`: API client and session helpers, pagination, realtime socket

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
