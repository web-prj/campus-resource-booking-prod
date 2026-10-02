# Campus Resource Booking — 5-minute presentation and 5-minute Q&A

> **Use this as a speaking script, not slide text.** The talk is designed for a live application demo with a short architecture slide. Rehearse it with a timer; if your demo is slow, skip optional actions rather than speaking faster. This version reflects the current staff-confirmed check-in flow: **there is no student-generated check-in code**. Staff can confirm arrival from the reservation start until its scheduled end.

## 5-minute presentation script

### 0:00–0:30 — Problem and introduction (landing page)

> Good morning, teacher and everyone. Our project is **Campus Resource Booking**, a full-stack application for sharing USTH study rooms, laboratories, and equipment. Booking through messages or spreadsheets makes availability hard to see and can lead to scheduling conflicts. Our solution puts searching, reservations, staff approval, and administration in one place.

### 0:30–1:35 — Student journey (resource directory and booking)

> There are three roles: students book resources, staff handle approvals and visits, and admins manage the system. Let me start as a student. Here I can search by date, time, building, type, capacity, and amenities. Availability takes opening hours, closures, existing bookings, and past time slots into account.
>
> With a date and both time controls at *Any*, search finds resources free for their entire operating day, only before that day starts; I choose both times for a particular interval. Bookings are limited to three consecutive hours within 08:00–18:00 ICT and the resource's opening hours. I select an available laboratory and book a time slot. Because this laboratory requires approval, the request becomes **pending**. For a resource without that rule, it would be **confirmed** immediately. Approval belongs to the *resource*, not to the student's account. The slot is reserved even while approval is pending, so someone else cannot take it. I can see the result and my booking history under **My bookings**.

**Do:** Open `/resources`, apply a filter, choose a future date and a daytime interval between 08:00 and 18:00 ICT, show the lab's availability, then submit a booking. If a live booking is not practical, show the seeded pending booking instead. Do not book a slot needed by the next presenter.

### 1:35–2:25 — Staff operations (staff window)

> In the staff account, the request appears in the approval queue. Staff can approve it, changing its status from pending to confirmed, or reject it with a reason. For a current confirmed booking, the student shows their confirmation in their signed-in account. Staff compare its full booking ID, student identity, resource, and time with the live record and **confirm check-in manually**. They then confirm check-out when the visit is complete. After the scheduled end, staff can record a no-show or the periodic release job will do it and expire unreviewed pending requests. This version does **not** use a six-digit code or QR code for check-in.

**Do:** Approve the pending request. For a representative live visit, seed between **08:00 and 17:59 ICT**; have the student show the current confirmed booking, match it against the staff record, then confirm check-in and check-out **before its scheduled end**. Check-in is permitted from the scheduled start **up to, but not including**, the end. The seed still inserts a current-hour booking through 22:59 by writing directly to the database, but a new student booking beginning at or after 18:00 is not allowed. Outside the usable demo window, show the operations screen and describe the process instead.

### 2:25–3:00 — Admin and real-time updates (admin window)

> Administrators can manage the resource catalog, operating hours, approval requirements, maintenance status, and closure dates. They can also manage user access and view analytics such as booking counts, cancellation rate, popular resources, peak hours, and scheduled utilization. When availability changes, Socket.IO notifies clients viewing the relevant resource and date so they can refresh the displayed slots.

**Do:** Show `/admin/analytics`, then `/admin/resources`. If two authenticated windows are ready on the same resource and date, point out the live availability update; otherwise describe it without claiming to have demonstrated it.

### 3:00–4:10 — Architecture and the main technical challenge (one diagram)

> The frontend uses **Next.js, React, and TypeScript**. The API is built with modular **NestJS** services. **PostgreSQL** stores users, buildings, resources, closures, and bookings. Docker Compose runs the frontend, API, and database together.
>
> Our most important technical problem is **double-booking**. Two students can both see the same free slot and press Book at almost the same time. A browser-side check cannot prevent that race. Our backend creates a booking inside a transaction and locks the resource row. More importantly, PostgreSQL has an **exclusion constraint** over the resource and booking time range: overlapping pending, confirmed, or checked-in reservations cannot coexist. If requests conflict, one succeeds and the other receives **409 Conflict**. Adjacent slots such as 10–11 and 11–12 remain valid.

**Show:** A diagram: `Browser → Next.js → NestJS → PostgreSQL`, with `Socket.IO` beside the API; then `2 simultaneous requests → 1 booking + 1 conflict`.

### 4:10–4:45 — Security and measured quality

> Users sign in with USTH email addresses. Passwords are hashed; the JWT is sent in an **httpOnly cookie** rather than stored in browser JavaScript. The backend requires authentication by default and uses role guards for staff and admin operations. We also use request validation, rate limiting, and database migrations.
>
> We tested the actual API with a synthetic dataset of **1,000 resources and 50,000 bookings**. In a repeated concurrency test, **100 users attempted the same slot for each of 20 slots; exactly one booking succeeded per slot**. Our documented single-process mixed-read capacity was around **250 requests per second**; response latency increased under heavier stress. These are measurements from a specific test environment, not a universal production guarantee.

### 4:45–5:00 — Conclusion

> To conclude, the system connects the student booking journey with staff operations and administrator oversight. The database protects bookings even during concurrent requests, while real-time updates keep availability useful. Thank you — we welcome your questions.

## Slide / screen checklist

1. **Title and problem:** project name, team, one-sentence problem.
2. **Student live demo:** `/resources` → availability → pending or confirmed booking.
3. **Staff live demo:** `/staff` → approval → current booking check-in/check-out if within the window.
4. **Admin live demo:** `/admin/analytics` and `/admin/resources`.
5. **Architecture and concurrency:** simple stack diagram plus two-bookers/one-slot diagram.
6. **Security and evidence:** httpOnly cookie, role guards, test results with their conditions.

If the demo fails, move to the next screen rather than debugging on stage. See [presentation kit](README.md) for diagrams and [benchmark methodology](../benchmarks/README.md) for the test setup.

## Q&A: prepare for roughly 5 minutes

You will probably answer **3–5 questions**, not all of the following. Lead with the first sentence, then expand only if asked.

### How do you prevent double-booking?

> PostgreSQL is the final authority: an exclusion constraint rejects overlapping active reservations for the same resource. The API also uses a transaction and a pessimistic resource-row lock. The losing request receives HTTP 409. Pending bookings block the slot too, until they are rejected or expire.

### Why use both a lock and a constraint?

> The lock coordinates the normal booking workflow; the constraint protects data integrity even if simultaneous requests or another code path bypass an application-level check. We use both for defense in depth.

### What if two students book adjacent hours?

> That is allowed. The booking range uses `[start, end)`, so a booking ending at 11:00 does not overlap one starting at 11:00.

### Why PostgreSQL instead of just checking available slots in the frontend?

> Two browsers can both display a slot as free before either sends a request. Only server-side and database enforcement can resolve that race reliably. PostgreSQL gives us transactions, time-range constraints, and indexes for these queries.

### How does approval work? What happens to an unreviewed request?

> The resource's `requiresApproval` setting determines whether a booking starts as pending or confirmed. Pending holds the slot. Staff can approve or reject it until the reservation ends; an unreviewed request after that boundary is marked expired when the release job runs. Its elapsed hours cannot be booked again.

### How does check-in work now?

> The student shows the confirmed booking in their signed-in account. Staff compare its full booking ID, student identity, resource, and time with the live staff record and confirm check-in without a code or QR scan. Staff can check in from the scheduled start up to, but not including, the reservation end, then record check-out. If nobody checks in by the end, the release process records a no-show (or staff can mark it then); elapsed hours cannot be booked again.

### Why put the JWT in an httpOnly cookie?

> Frontend JavaScript cannot directly read an httpOnly cookie, unlike a token in localStorage. That reduces token-theft risk from injected scripts; it does not eliminate every XSS risk. Browser requests include credentials, and the backend authenticates the cookie on each request.

### How do you enforce roles?

> Authentication and role guards run globally on backend HTTP requests. Endpoints are protected unless explicitly public. Role decorators restrict student, staff, and admin actions; frontend route redirects are for user experience, not the security boundary.

### What happens when an admin deactivates an account?

> The authentication strategy looks up the user and checks the session version on protected requests. Deactivation increments that version, so the old cookie stays invalid even after reactivation; a new sign-in is required. Connected WebSockets are disconnected. Admin-management rules also prevent accidental loss of the last active administrator, and bootstrap recovery never promotes an existing student or staff account.

### Is availability really real-time?

> Booking and resource creation or changes trigger Socket.IO events. Authenticated clients subscribe to resource-and-date rooms, receive a notification, and refresh the relevant data. The database remains authoritative: a WebSocket event is a refresh signal, not permission to bypass booking validation.

### What do the analytics mean?

> They report booking status counts, cancellation rate, popularity, peak hours, and scheduled utilization for a selected date range. Utilization compares scheduled booking hours with capacity based on active resources' current opening schedules and closures. It measures **scheduled usage**, not physical occupancy; the API documents which statuses are excluded.

### What performance evidence do you have?

> The repository contains benchmark runners and reports under `docs/benchmarks/`. On a synthetic 1,000-resource, 50,000-booking dataset, indexed slot-search service p50 improved from roughly 23–30 ms to 13–18 ms. A separate HTTP concurrency test found one success per slot in 20 storms of 100 requests, and around 250 mixed-read requests per second at saturation for one API process. These numbers depend on that host, dataset, and workload; latency increased significantly at 800 simulated users.

### Is Redis used?

> No. The current buildings endpoint uses Nest's in-process response cache. Redis is a possible future improvement if we scale to multiple API processes, where cache entries, rate limits, and Socket.IO events need coordinated shared infrastructure.

### What are the limitations and next steps?

> Benchmark data is synthetic and from a particular environment, not a production SLA. One API process becomes CPU-bound under heavy concurrent reads. A practical next step is multi-process scaling with shared Redis-backed infrastructure, plus notifications and further usability testing. We should measure those changes rather than assume they are faster.

## Before presenting

- Rebuild the stack and check health: `docker compose up -d --build` then `docker compose ps`. **Do not** delete the PostgreSQL volume.
- If using demo records, follow [MVP release demo-data instructions](../MVP_RELEASE.md#5-demo-data), ideally seed just before the talk during 08:00–17:59 ICT for a live, in-window check-in. The seed inserts current-hour visits until 22:59, but those beginning at or after 18:00 are seed-only exceptions and cannot be booked through the student flow. Outside 08:00–22:59 it omits the visit. Use separate browser profiles for student, staff, and admin because one profile shares one login cookie.
- Keep a screenshot or the diagrams in [this presentation kit](README.md) as fallback, but present the running app if the course requires it.
- Clean up local demo data afterward with the documented `npm run demo:clean` command. Do not disclose demo passwords on slides.
- Rehearse aloud at least twice and finish around **4:40–4:50**, leaving a small timing buffer.
