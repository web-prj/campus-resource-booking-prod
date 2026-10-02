import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { BookingsService } from '../src/bookings/bookings.service';
import { createTestApp, deleteUsers, findSetCookie } from './utils/test-app';

jest.setTimeout(15_000);

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const STUDENT_EMAIL = `checkin.student.${RUN_ID}@usth.edu.vn`;
const STAFF_EMAIL = `checkin.staff.${RUN_ID}@usth.edu.vn`;
const PASSWORD = 'password123';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'access_token';
const BUILDING_ID = '10000000-0000-4000-8000-000000000001';

describe('Check-in and checkout (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let studentCookie: string;
  let staffCookie: string;
  let studentId: string;
  let staffId: string;
  let resourceId: string;
  let now = new Date('2099-01-20T01:50:00.000Z'); // 08:50 ICT

  const api = () => request(app.getHttpServer());

  async function register(email: string, fullName: string) {
    const response = await api()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, fullName })
      .expect(201);
    return {
      id: response.body.id as string,
      cookie: findSetCookie(response.headers, COOKIE_NAME) as string,
    };
  }

  async function login(email: string): Promise<string> {
    const response = await api()
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return findSetCookie(response.headers, COOKIE_NAME) as string;
  }

  beforeAll(async () => {
    app = await createTestApp(() => now);
    dataSource = app.get(DataSource);
    const student = await register(STUDENT_EMAIL, 'Check-in Student');
    studentId = student.id;
    studentCookie = student.cookie;
    const staff = await register(STAFF_EMAIL, 'Check-in Staff');
    staffId = staff.id;
    await dataSource.query(
      `UPDATE users SET role = 'staff'::users_role_enum WHERE email = $1`,
      [STAFF_EMAIL],
    );
    staffCookie = await login(STAFF_EMAIL);
    const [resource] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO resources (
        code, name, type, status, capacity, location, requires_approval,
        operating_days, opens_at, closes_at, building_id
      ) VALUES ($1, 'Check-in Room', 'room', 'active', 8, 'Operations desk', false,
        ARRAY[1,2,3,4,5,6]::smallint[], '08:00', '18:00', $2)
      RETURNING id`,
      [`CI-${Date.now().toString(36).slice(-7)}`, BUILDING_ID],
    );
    resourceId = resource.id;
  });

  afterAll(async () => {
    if (resourceId) {
      await dataSource.query('DELETE FROM bookings WHERE resource_id = $1', [
        resourceId,
      ]);
      await dataSource.query('DELETE FROM resources WHERE id = $1', [
        resourceId,
      ]);
    }
    await deleteUsers(app, [STUDENT_EMAIL, STAFF_EMAIL]);
    await app.close();
  });

  it('manually confirms check-in without student action, records the actor, and completes checkout', async () => {
    const created = await api()
      .post('/api/bookings')
      .set('Cookie', studentCookie)
      .send({
        resourceId,
        date: '2099-01-20',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    const bookingId = created.body.id as string;

    await api()
      .patch(`/api/bookings/mine/${bookingId}/check-in`)
      .set('Cookie', studentCookie)
      .expect(404);
    const studentView = await api()
      .get(`/api/bookings/mine/${bookingId}`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(studentView.body).toMatchObject({
      canRequestCheckIn: false,
      checkInRequestedAt: null,
    });
    expect(studentView.body).toHaveProperty('checkInCode', null);
    await api()
      .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
      .set('Cookie', studentCookie)
      .expect(403);
    await api()
      .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
      .set('Cookie', staffCookie)
      .send({ code: '123456' })
      .expect(400);

    now = new Date('2099-01-20T02:05:00.000Z'); // 09:05 ICT
    const head = await api()
      .get('/api/staff/bookings/operations?pageSize=50')
      .set('Cookie', staffCookie)
      .expect(200);
    const lastPage = await api()
      .get(
        `/api/staff/bookings/operations?page=${Math.max(head.body.totalPages, 1)}&pageSize=50`,
      )
      .set('Cookie', staffCookie)
      .expect(200);
    expect(
      lastPage.body.items.find((item: { id: string }) => item.id === bookingId),
    ).toMatchObject({ checkInRequested: false, canConfirmCheckIn: true });

    const checkInResponses = await Promise.all([
      api()
        .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
        .set('Cookie', staffCookie),
      api()
        .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
        .set('Cookie', staffCookie),
    ]);
    expect(checkInResponses.map(({ status }) => status).sort()).toEqual([
      200, 409,
    ]);
    const checkedIn = checkInResponses.find(
      ({ status }) => status === 200,
    ) as request.Response;
    expect(checkedIn.body).toMatchObject({
      status: 'checked_in',
      checkInRequested: false,
      canCheckOut: true,
      checkedInAt: now.toISOString(),
    });
    const [persisted] = await dataSource.query<
      {
        check_in_code: string | null;
        check_in_requested_at: Date | null;
        checked_in_at: Date;
        checked_in_by_id: string;
      }[]
    >(
      'SELECT check_in_code, check_in_requested_at, checked_in_at, checked_in_by_id FROM bookings WHERE id = $1',
      [bookingId],
    );
    expect(persisted).toEqual({
      check_in_code: null,
      check_in_requested_at: null,
      checked_in_at: now,
      checked_in_by_id: staffId,
    });

    const completed = await api()
      .patch(`/api/staff/bookings/${bookingId}/check-out`)
      .set('Cookie', staffCookie)
      .expect(200);
    expect(completed.body).toMatchObject({
      status: 'completed',
      canCheckOut: false,
      checkedOutAt: expect.any(String),
    });
    await api()
      .patch(`/api/staff/bookings/${bookingId}/check-out`)
      .set('Cookie', staffCookie)
      .expect(409);
    const detail = await api()
      .get(`/api/bookings/mine/${bookingId}`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(detail.body).toMatchObject({
      status: 'completed',
      checkInRequestedAt: null,
      checkedInAt: expect.any(String),
      checkedOutAt: expect.any(String),
    });
    expect(detail.body).toHaveProperty('checkInCode', null);
  });

  it('retires an outstanding legacy code without requiring a new request', async () => {
    now = new Date('2099-01-20T02:50:00.000Z'); // 09:50 ICT
    const [legacy] = await dataSource.query<{ id: string }[]>(
      `
      INSERT INTO bookings (resource_id, requester_id, booking_date, start_time, end_time,
        status, check_in_requested_at)
      VALUES ($1, $2, '2099-01-20', '10:00', '11:00', 'confirmed', $3)
      RETURNING id`,
      [resourceId, studentId, now],
    );
    await api()
      .patch(`/api/staff/bookings/${legacy.id}/confirm-check-in`)
      .set('Cookie', staffCookie)
      .send({ code: '123456' })
      .expect(400);
    const view = await api()
      .get(`/api/bookings/mine/${legacy.id}`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(view.body).toHaveProperty('checkInCode', null);
    now = new Date('2099-01-20T03:05:00.000Z'); // 10:05 ICT
    await api()
      .patch(`/api/staff/bookings/${legacy.id}/confirm-check-in`)
      .set('Cookie', staffCookie)
      .expect(200);
    const [persisted] = await dataSource.query<
      { checked_in_by_id: string; check_in_code: string | null }[]
    >('SELECT checked_in_by_id, check_in_code FROM bookings WHERE id = $1', [
      legacy.id,
    ]);
    expect(persisted).toEqual({
      checked_in_by_id: staffId,
      check_in_code: null,
    });
    await api()
      .patch(`/api/staff/bookings/${legacy.id}/check-out`)
      .set('Cookie', staffCookie)
      .expect(200);
  });

  it('allows the student to cancel a confirmed legacy request before start', async () => {
    now = new Date('2099-01-20T02:50:00.000Z'); // 09:50 ICT
    const [legacy] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO bookings (
        resource_id, requester_id, booking_date, start_time, end_time, status,
        check_in_requested_at
      ) VALUES ($1, $2, '2099-01-20', '11:00', '12:00', 'confirmed',
        '2099-01-20T03:45:00.000Z')
      RETURNING id`,
      [resourceId, studentId],
    );
    const view = await api()
      .get(`/api/bookings/mine/${legacy.id}`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(view.body).toMatchObject({
      canCancel: true,
      canRequestCheckIn: false,
    });
    expect(view.body).toHaveProperty('checkInCode', null);

    const cancelled = await api()
      .patch(`/api/bookings/mine/${legacy.id}/cancel`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'cancelled',
      canCancel: false,
      checkInRequestedAt: null,
    });
    await api()
      .patch(`/api/bookings/mine/${legacy.id}/cancel`)
      .set('Cookie', studentCookie)
      .expect(409);
  });

  it('keeps overdue unresolved visits on the staff operations dashboard', async () => {
    now = new Date('2099-01-20T08:00:00.000Z'); // 15:00 ICT
    const rows = await dataSource.query<{ id: string; status: string }[]>(
      `INSERT INTO bookings (
        resource_id, requester_id, booking_date, start_time, end_time, status,
        check_in_requested_at, checked_in_at, checked_in_by_id,
        no_show_at, no_show_by_id
      ) VALUES
        ($1, $2, '2099-01-18', '09:00', '10:00', 'checked_in',
          '2099-01-18T01:50:00.000Z', '2099-01-18T01:55:00.000Z', $3,
          NULL, NULL),
        ($1, $2, '2099-01-19', '09:00', '10:00', 'confirmed',
          NULL, NULL, NULL, NULL, NULL),
        ($1, $2, '2099-01-19', '11:00', '12:00', 'no_show',
          NULL, NULL, NULL, '2099-01-19T05:00:00.000Z', $3),
        ($1, $2, '2099-01-21', '09:00', '10:00', 'confirmed',
          NULL, NULL, NULL, NULL, NULL)
      RETURNING id, status`,
      [resourceId, studentId, staffId],
    );
    const checkedInId = rows.find(({ status }) => status === 'checked_in')?.id;
    const confirmedIds = rows
      .filter(({ status }) => status === 'confirmed')
      .map(({ id }) => id);
    const noShowId = rows.find(({ status }) => status === 'no_show')?.id;

    const operations = await api()
      .get('/api/staff/bookings/operations')
      .set('Cookie', staffCookie)
      .expect(200);
    const ids = operations.body.items.map((item: { id: string }) => item.id);

    expect(ids).toEqual(expect.arrayContaining([checkedInId, confirmedIds[0]]));
    expect(ids).not.toContain(noShowId);
    expect(ids).not.toContain(confirmedIds[1]);
    expect(operations.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: checkedInId, canCheckOut: true }),
        expect.objectContaining({ id: confirmedIds[0], canMarkNoShow: true }),
      ]),
    );
    expect(operations.body).toMatchObject({
      total: expect.any(Number),
      page: 1,
      pageSize: 20,
      totalPages: 1,
      campusDate: '2099-01-20',
    });

    const firstPage = await api()
      .get('/api/staff/bookings/operations?page=1&pageSize=1')
      .set('Cookie', staffCookie)
      .expect(200);
    const secondPage = await api()
      .get('/api/staff/bookings/operations?page=2&pageSize=1')
      .set('Cookie', staffCookie)
      .expect(200);
    expect(firstPage.body).toMatchObject({
      total: operations.body.total,
      page: 1,
      pageSize: 1,
      totalPages: operations.body.total,
      campusDate: '2099-01-20',
    });
    expect(
      [...firstPage.body.items, ...secondPage.body.items].map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual([checkedInId, confirmedIds[0]]);
    const beyond = await api()
      .get('/api/staff/bookings/operations?page=3&pageSize=1')
      .set('Cookie', staffCookie)
      .expect(200);
    expect(beyond.body).toMatchObject({
      total: operations.body.total,
      page: 3,
    });

    for (const query of ['page=0', 'pageSize=0', 'pageSize=51', 'page=x']) {
      await api()
        .get(`/api/staff/bookings/operations?${query}`)
        .set('Cookie', staffCookie)
        .expect(400);
    }
  });

  it('keeps only requests before their scheduled end in the pending queue', async () => {
    now = new Date('2099-01-20T03:30:00.000Z'); // 10:30 ICT
    const rows = await dataSource.query<{ id: string }[]>(
      `INSERT INTO bookings (
        resource_id, requester_id, booking_date, start_time, end_time, status
      ) VALUES
        ($1, $2, '2099-01-19', '15:00', '16:00', 'pending'),
        ($1, $2, '2099-01-20', '07:00', '08:00', 'pending'),
        ($1, $2, '2099-01-20', '11:00', '12:00', 'pending'),
        ($1, $2, '2099-01-21', '08:00', '09:00', 'pending'),
        ($1, $2, '2099-01-20', '10:00', '11:00', 'pending')
      RETURNING id`,
      [resourceId, studentId],
    );
    const idAt = (index: number) => rows[index].id;

    // Requests are ordered oldest first, so ours are on the final pages.
    const head = await api()
      .get('/api/staff/bookings/pending?pageSize=50')
      .set('Cookie', staffCookie)
      .expect(200);
    expect(head.body).toMatchObject({ page: 1, pageSize: 50 });
    const items: { id: string; canReview: boolean }[] = [...head.body.items];
    for (const page of [head.body.totalPages - 1, head.body.totalPages]) {
      if (page <= 1) continue;
      const tail = await api()
        .get(`/api/staff/bookings/pending?page=${page}&pageSize=50`)
        .set('Cookie', staffCookie)
        .expect(200);
      items.push(...tail.body.items);
    }
    const ids = items.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([idAt(2), idAt(3)]));
    expect(ids).not.toContain(idAt(0));
    expect(ids).not.toContain(idAt(1));
    // Still within its 10:00–11:00 reservation, so review remains possible.
    expect(ids).toContain(idAt(4));
    expect(items.every((item) => item.canReview)).toBe(true);

    // Independent timestamp-based formulation of "reservation not ended yet".
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      `SELECT count(*)::text AS count FROM bookings
       WHERE status = 'pending'
         AND (booking_date + end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh' > $1`,
      [now.toISOString()],
    );
    expect(head.body.total).toBe(Number(count));

    await dataSource.query('DELETE FROM bookings WHERE id = ANY($1)', [
      rows.map(({ id }) => id),
    ]);
  });

  it('rejects early check-in and permits no-show only after the scheduled end', async () => {
    now = new Date('2099-01-20T02:00:00.000Z'); // 09:00 ICT
    const created = await api()
      .post('/api/bookings')
      .set('Cookie', studentCookie)
      .send({
        resourceId,
        date: '2099-01-20',
        startTime: '11:00',
        endTime: '12:00',
      })
      .expect(201);
    const bookingId = created.body.id as string;

    await api()
      .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
      .set('Cookie', staffCookie)
      .expect(409);
    await api()
      .patch(`/api/staff/bookings/${bookingId}/no-show`)
      .set('Cookie', studentCookie)
      .expect(403);
    await api()
      .patch(`/api/staff/bookings/${bookingId}/no-show`)
      .set('Cookie', staffCookie)
      .expect(409);

    now = new Date('2099-01-20T04:59:59.000Z'); // 11:59:59 ICT
    await api()
      .patch(`/api/staff/bookings/${bookingId}/no-show`)
      .set('Cookie', staffCookie)
      .expect(409);

    now = new Date('2099-01-20T05:00:00.000Z'); // 12:00 ICT, the scheduled end
    const noShow = await api()
      .patch(`/api/staff/bookings/${bookingId}/no-show`)
      .set('Cookie', staffCookie)
      .expect(200);
    expect(noShow.body).toMatchObject({
      status: 'no_show',
      checkInRequested: false,
      noShowAt: expect.any(String),
      releasedAutomatically: false,
    });
    await api()
      .patch(`/api/staff/bookings/${bookingId}/no-show`)
      .set('Cookie', staffCookie)
      .expect(409);
  });

  it('allows arrival during the reservation and closes check-in at its end', async () => {
    now = new Date('2099-01-20T05:50:00.000Z'); // 12:50 ICT
    const created = await api()
      .post('/api/bookings')
      .set('Cookie', studentCookie)
      .send({
        resourceId,
        date: '2099-01-20',
        startTime: '13:00',
        endTime: '14:00',
      })
      .expect(201);
    const bookingId = created.body.id as string;
    now = new Date('2099-01-20T06:59:59.000Z'); // 13:59:59 ICT, just before the end
    await api()
      .patch(`/api/staff/bookings/${bookingId}/no-show`)
      .set('Cookie', staffCookie)
      .expect(409);
    const responses = await Promise.all([
      api()
        .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
        .set('Cookie', staffCookie),
      api()
        .patch(`/api/staff/bookings/${bookingId}/no-show`)
        .set('Cookie', staffCookie),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    const checkedIn = responses.find(
      ({ status }) => status === 200,
    ) as request.Response;
    expect(checkedIn.body).toMatchObject({ status: 'checked_in' });
    const [persisted] = await dataSource.query<
      { check_in_code: string | null; status: string }[]
    >('SELECT status, check_in_code FROM bookings WHERE id = $1', [bookingId]);
    expect(persisted).toEqual({ status: 'checked_in', check_in_code: null });
  });

  it('releases a confirmed booking nobody checked in by its scheduled end', async () => {
    const release = () => app.get(BookingsService).releaseMissedDeadlines();
    now = new Date('2099-01-20T07:50:00.000Z'); // 14:50 ICT
    const missed = await api()
      .post('/api/bookings')
      .set('Cookie', studentCookie)
      .send({
        resourceId,
        date: '2099-01-20',
        startTime: '15:00',
        endTime: '17:00',
      })
      .expect(201);
    const missedId = missed.body.id as string;
    expect(missed.body).toMatchObject({ status: 'confirmed' });
    const missedView = await api()
      .get(`/api/bookings/mine/${missedId}`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(missedView.body).toMatchObject({
      checkInDeadline: '2099-01-20T10:00:00.000Z',
      releasedAutomatically: false,
      canRequestCheckIn: false,
    });

    const attended = await api()
      .post('/api/bookings')
      .set('Cookie', studentCookie)
      .send({
        resourceId,
        date: '2099-01-20',
        startTime: '17:00',
        endTime: '18:00',
      })
      .expect(201);
    const attendedId = attended.body.id as string;

    now = new Date('2099-01-20T09:59:59.000Z'); // 16:59:59 ICT
    await release();
    const [stillConfirmed] = await dataSource.query<{ status: string }[]>(
      'SELECT status FROM bookings WHERE id = $1',
      [missedId],
    );
    expect(stillConfirmed.status).toBe('confirmed');

    // A confirmed booking cannot be checked in once its scheduled end passes.
    now = new Date('2099-01-20T10:00:00.000Z'); // 17:00 ICT
    await api()
      .patch(`/api/staff/bookings/${missedId}/confirm-check-in`)
      .set('Cookie', staffCookie)
      .expect(409);
    expect((await release()).released).toBeGreaterThanOrEqual(1);
    expect((await release()).released).toBe(0);

    const [released] = await dataSource.query<
      {
        status: string;
        check_in_code: string | null;
        no_show_at: Date | null;
        no_show_by_id: string | null;
      }[]
    >(
      'SELECT status, check_in_code, no_show_at, no_show_by_id FROM bookings WHERE id = $1',
      [missedId],
    );
    expect(released).toEqual({
      status: 'no_show',
      check_in_code: null,
      no_show_at: now,
      no_show_by_id: null,
    });
    const studentView = await api()
      .get(`/api/bookings/mine/${missedId}`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(studentView.body).toMatchObject({
      status: 'no_show',
      releasedAutomatically: true,
    });
    expect(studentView.body).toHaveProperty('checkInCode', null);
    const staffView = await api()
      .get(`/api/staff/bookings/${missedId}`)
      .set('Cookie', staffCookie)
      .expect(200);
    expect(staffView.body).toMatchObject({
      status: 'no_show',
      releasedAutomatically: true,
      canMarkNoShow: false,
    });

    // Past hours cannot be rebooked. A future slot is available after release.
    const rebooked = await api()
      .post('/api/bookings')
      .set('Cookie', studentCookie)
      .send({
        resourceId,
        date: '2099-01-21',
        startTime: '16:00',
        endTime: '17:00',
      })
      .expect(201);

    // A booking checked in before its end is never released.
    now = new Date('2099-01-20T10:14:00.000Z'); // 17:14 ICT
    await api()
      .patch(`/api/staff/bookings/${attendedId}/confirm-check-in`)
      .set('Cookie', staffCookie)
      .expect(200);
    now = new Date('2099-01-20T11:30:00.000Z'); // 18:30 ICT
    await release();
    const statuses = await dataSource.query<{ id: string; status: string }[]>(
      'SELECT id, status FROM bookings WHERE id = ANY($1)',
      [[attendedId, rebooked.body.id]],
    );
    expect(
      Object.fromEntries(statuses.map((row) => [row.id, row.status])),
    ).toEqual({
      [attendedId]: 'checked_in',
      [rebooked.body.id as string]: 'confirmed',
    });
  });

  it('expires a request nobody reviewed by its scheduled end', async () => {
    const release = () => app.get(BookingsService).releaseMissedDeadlines();
    now = new Date('2099-01-22T05:50:00.000Z'); // 12:50 ICT
    const [pending] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO bookings (
        resource_id, requester_id, booking_date, start_time, end_time, status
      ) VALUES ($1, $2, '2099-01-22', '13:00', '15:00', 'pending')
      RETURNING id`,
      [resourceId, studentId],
    );

    now = new Date('2099-01-22T07:59:59.000Z'); // 14:59:59 ICT
    expect((await release()).expired).toBe(0);
    const reviewable = await api()
      .get(`/api/staff/bookings/${pending.id}`)
      .set('Cookie', staffCookie)
      .expect(200);
    expect(reviewable.body).toMatchObject({
      status: 'pending',
      canReview: true,
    });

    // A late approval would create a booking nobody can check in any more.
    now = new Date('2099-01-22T08:00:00.000Z'); // 15:00 ICT
    const late = await api()
      .patch(`/api/staff/bookings/${pending.id}/approve`)
      .set('Cookie', staffCookie)
      .expect(409);
    expect(late.body.code).toBe('BOOKING_REVIEW_WINDOW_ENDED');

    expect((await release()).expired).toBeGreaterThanOrEqual(1);
    expect((await release()).expired).toBe(0);
    const [expired] = await dataSource.query<
      { status: string; reviewed_at: Date | null }[]
    >('SELECT status, reviewed_at FROM bookings WHERE id = $1', [pending.id]);
    expect(expired).toEqual({ status: 'expired', reviewed_at: null });

    const studentView = await api()
      .get(`/api/bookings/mine/${pending.id}`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(studentView.body).toMatchObject({
      status: 'expired',
      canCancel: false,
      canRequestCheckIn: false,
      releasedAutomatically: false,
    });
    const timeline = await api()
      .get('/api/bookings/mine')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(
      timeline.body.history.map((booking: { id: string }) => booking.id),
    ).toContain(pending.id);
    await api()
      .patch(`/api/staff/bookings/${pending.id}/reject`)
      .set('Cookie', staffCookie)
      .send({ reason: 'Too late to review.' })
      .expect(409);

    // Future hours remain bookable.
    await api()
      .post('/api/bookings')
      .set('Cookie', studentCookie)
      .send({
        resourceId,
        date: '2099-01-22',
        startTime: '16:00',
        endTime: '17:00',
      })
      .expect(201);
  });

  it('enforces lifecycle shape and chronology directly in PostgreSQL', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          checked_in_at, checked_in_by_id
        ) VALUES ($1, $2, '2099-01-21', '11:00', '12:00', 'checked_in',
          '2099-01-21T03:44:59.000Z', $3)`,
        [resourceId, studentId, staffId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_check_in_timeline',
    });
    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          checked_in_at
        ) VALUES ($1, $2, '2099-01-21', '11:00', '12:00', 'checked_in',
          '2099-01-21T03:45:00.000Z')`,
        [resourceId, studentId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_checked_in_state',
    });
    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          check_in_code
        ) VALUES ($1, $2, '2099-01-21', '09:00', '10:00', 'confirmed', '123456')`,
        [resourceId, studentId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_check_in_request',
    });
    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          check_in_requested_at
        ) VALUES ($1, $2, '2099-01-22', '09:00', '10:00', 'confirmed',
          '2099-01-22T01:30:00.000Z')`,
        [resourceId, studentId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_check_in_timeline',
    });

    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          check_in_requested_at, checked_in_at, checked_in_by_id,
          checked_out_at, checked_out_by_id
        ) VALUES ($1, $2, '2099-01-23', '09:00', '10:00', 'completed',
          '2099-01-23T01:50:00.000Z', '2099-01-23T02:00:00.000Z', $3,
          '2099-01-23T01:59:59.000Z', $3)`,
        [resourceId, studentId, studentId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_check_in_timeline',
    });

    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          no_show_at, no_show_by_id
        ) VALUES ($1, $2, '2099-01-24', '09:00', '10:00', 'no_show',
          '2099-01-24T02:59:59.000Z', $3)`,
        [resourceId, studentId, studentId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_no_show_timeline',
    });

    const [released] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO bookings (
        resource_id, requester_id, booking_date, start_time, end_time, status,
        no_show_at, no_show_by_id
      ) VALUES ($1, $2, '2099-01-24', '09:00', '10:00', 'no_show',
        '2099-01-24T03:00:00.000Z', NULL)
      RETURNING id`,
      [resourceId, studentId],
    );
    await dataSource.query('DELETE FROM bookings WHERE id = $1', [released.id]);
    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          no_show_by_id
        ) VALUES ($1, $2, '2099-01-24', '09:00', '10:00', 'confirmed', $3)`,
        [resourceId, studentId, studentId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_no_show_state',
    });
  });
});
