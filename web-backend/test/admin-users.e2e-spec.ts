import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, deleteUsers, findSetCookie } from './utils/test-app';

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ADMIN_EMAIL = `users.admin.${RUN_ID}@usth.edu.vn`;
const OTHER_ADMIN_EMAIL = `users.other-admin.${RUN_ID}@usth.edu.vn`;
const STUDENT_EMAIL = `users.student.${RUN_ID}@usth.edu.vn`;
const SEARCH_EMAIL = `unique.directory.${RUN_ID}@usth.edu.vn`;
const RACE_ADMIN_A_EMAIL = `users.race-a.${RUN_ID}@usth.edu.vn`;
const RACE_ADMIN_B_EMAIL = `users.race-b.${RUN_ID}@usth.edu.vn`;
const STAFF_EMAIL = `users.new-staff.${RUN_ID}@usth.edu.vn`;
const PASSWORD = 'password123';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'access_token';

describe('Admin user and staff account management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminCookie: string;
  let studentCookie: string;
  let otherAdminCookie: string;
  let adminId: string;
  let otherAdminId: string;
  let studentId: string;
  let searchId: string;
  let raceAdminAId: string;
  let raceAdminBId: string;
  let raceAdminACookie: string;
  let raceAdminBCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    for (const [email, fullName] of [
      [ADMIN_EMAIL, 'User Directory Admin'],
      [OTHER_ADMIN_EMAIL, 'Second Directory Admin'],
      [STUDENT_EMAIL, 'Directory Student'],
      [SEARCH_EMAIL, 'Unique Search Person'],
      [RACE_ADMIN_A_EMAIL, 'Race Administrator A'],
      [RACE_ADMIN_B_EMAIL, 'Race Administrator B'],
    ]) {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: PASSWORD, fullName })
        .expect(201);
    }

    await dataSource.query(
      `UPDATE users SET role = 'admin'::users_role_enum WHERE email = ANY($1)`,
      [
        [
          ADMIN_EMAIL,
          OTHER_ADMIN_EMAIL,
          RACE_ADMIN_A_EMAIL,
          RACE_ADMIN_B_EMAIL,
        ],
      ],
    );
    const users = await dataSource.query<{ id: string; email: string }[]>(
      `SELECT id, email FROM users WHERE email = ANY($1)`,
      [
        [
          ADMIN_EMAIL,
          OTHER_ADMIN_EMAIL,
          STUDENT_EMAIL,
          SEARCH_EMAIL,
          RACE_ADMIN_A_EMAIL,
          RACE_ADMIN_B_EMAIL,
        ],
      ],
    );
    const ids = Object.fromEntries(users.map((user) => [user.email, user.id]));
    adminId = ids[ADMIN_EMAIL];
    otherAdminId = ids[OTHER_ADMIN_EMAIL];
    studentId = ids[STUDENT_EMAIL];
    searchId = ids[SEARCH_EMAIL];
    raceAdminAId = ids[RACE_ADMIN_A_EMAIL];
    raceAdminBId = ids[RACE_ADMIN_B_EMAIL];

    adminCookie = findSetCookie(
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: ADMIN_EMAIL, password: PASSWORD })
          .expect(200)
      ).headers,
      COOKIE_NAME,
    ) as string;
    otherAdminCookie = findSetCookie(
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: OTHER_ADMIN_EMAIL, password: PASSWORD })
          .expect(200)
      ).headers,
      COOKIE_NAME,
    ) as string;
    studentCookie = findSetCookie(
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: STUDENT_EMAIL, password: PASSWORD })
          .expect(200)
      ).headers,
      COOKIE_NAME,
    ) as string;
    raceAdminACookie = findSetCookie(
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: RACE_ADMIN_A_EMAIL, password: PASSWORD })
          .expect(200)
      ).headers,
      COOKIE_NAME,
    ) as string;
    raceAdminBCookie = findSetCookie(
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: RACE_ADMIN_B_EMAIL, password: PASSWORD })
          .expect(200)
      ).headers,
      COOKIE_NAME,
    ) as string;
  });

  afterAll(async () => {
    await deleteUsers(app, [
      ADMIN_EMAIL,
      OTHER_ADMIN_EMAIL,
      STUDENT_EMAIL,
      SEARCH_EMAIL,
      RACE_ADMIN_A_EMAIL,
      RACE_ADMIN_B_EMAIL,
      STAFF_EMAIL,
      `extra.${STAFF_EMAIL}`,
    ]);
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('requires authentication and an administrator role', async () => {
    await api().get('/api/admin/users').expect(401);
    await api()
      .get('/api/admin/users')
      .set('Cookie', studentCookie)
      .expect(403);
    await api()
      .patch(`/api/admin/users/${searchId}/status`)
      .set('Cookie', studentCookie)
      .send({ isActive: false })
      .expect(403);
  });

  it('searches and filters accounts without exposing password data', async () => {
    const response = await api()
      .get('/api/admin/users')
      .query({ q: 'Unique Search', role: 'student', isActive: true })
      .set('Cookie', adminCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      items: [
        {
          id: searchId,
          email: SEARCH_EMAIL,
          fullName: 'Unique Search Person',
          role: 'student',
          isActive: true,
        },
      ],
    });
    expect(response.body.items[0]).not.toHaveProperty('passwordHash');
  });

  it.each(['%', '_', '\\'])(
    'treats search metacharacter %p literally',
    async (q) => {
      const response = await api()
        .get('/api/admin/users')
        .query({ q })
        .set('Cookie', adminCookie)
        .expect(200);

      expect(response.body).toMatchObject({ items: [], total: 0 });
    },
  );

  it('returns authoritative metadata for an empty out-of-range page', async () => {
    const response = await api()
      .get('/api/admin/users')
      .query({ q: 'Unique Search', page: 99, pageSize: 1 })
      .set('Cookie', adminCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      items: [],
      total: 1,
      page: 99,
      pageSize: 1,
      totalPages: 1,
    });
  });

  it('validates list filters and mutation bodies strictly', async () => {
    await api()
      .get('/api/admin/users')
      .query({ role: 'owner' })
      .set('Cookie', adminCookie)
      .expect(400);
    await api()
      .patch(`/api/admin/users/${searchId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: false, role: 'admin' })
      .expect(400);
  });

  it('creates a staff account that can sign in with the initial password', async () => {
    await api()
      .post('/api/admin/users')
      .set('Cookie', studentCookie)
      .send({ email: STAFF_EMAIL, password: PASSWORD, fullName: 'New Staff' })
      .expect(403);

    const created = await api()
      .post('/api/admin/users')
      .set('Cookie', adminCookie)
      .send({
        email: `  ${STAFF_EMAIL.toUpperCase()} `,
        password: PASSWORD,
        fullName: '  New Staff  ',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      email: STAFF_EMAIL,
      fullName: 'New Staff',
      role: 'staff',
      isActive: true,
    });
    expect(created.body).not.toHaveProperty('password');
    expect(created.body).not.toHaveProperty('passwordHash');
    expect(created.headers['set-cookie']).toBeUndefined();

    const login = await api()
      .post('/api/auth/login')
      .send({ email: STAFF_EMAIL, password: PASSWORD })
      .expect(200);
    expect(login.body).toMatchObject({ email: STAFF_EMAIL, role: 'staff' });

    await api()
      .post('/api/admin/users')
      .set('Cookie', adminCookie)
      .send({ email: STAFF_EMAIL, password: PASSWORD, fullName: 'Duplicate' })
      .expect(409);
  });

  it('validates new staff account details', async () => {
    for (const body of [
      { email: 'staff@gmail.com', password: PASSWORD, fullName: 'Outside' },
      { email: STAFF_EMAIL, password: 'short', fullName: 'Short Password' },
      { email: STAFF_EMAIL, password: PASSWORD, fullName: '' },
      {
        email: `extra.${STAFF_EMAIL}`,
        password: PASSWORD,
        fullName: 'Extra Field',
        role: 'admin',
      },
    ]) {
      await api()
        .post('/api/admin/users')
        .set('Cookie', adminCookie)
        .send(body)
        .expect(400);
    }
  });

  it('offers no way to change an account role', async () => {
    await api()
      .patch(`/api/admin/users/${otherAdminId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'student' })
      .expect(404);
    await api()
      .get('/api/admin/users')
      .set('Cookie', otherAdminCookie)
      .expect(200);
  });

  it('prevents administrators from changing their own access', async () => {
    await api()
      .patch(`/api/admin/users/${adminId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: false })
      .expect(400);
  });

  it('deactivates an account, invalidates its session, and blocks login', async () => {
    await api()
      .patch(`/api/admin/users/${studentId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: false })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ id: studentId, isActive: false }),
      );

    await api().get('/api/auth/me').set('Cookie', studentCookie).expect(401);
    await api()
      .post('/api/auth/login')
      .send({ email: STUDENT_EMAIL, password: PASSWORD })
      .expect(401)
      .expect(({ body }) =>
        expect(body.message).toBe('Invalid email or password'),
      );

    await api()
      .patch(`/api/admin/users/${studentId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: true })
      .expect(200);
    // Deactivation revoked the original signed session, even after reactivation.
    await api().get('/api/auth/me').set('Cookie', studentCookie).expect(401);
    const newSession = await api()
      .post('/api/auth/login')
      .send({ email: STUDENT_EMAIL, password: PASSWORD })
      .expect(200);
    await api()
      .get('/api/auth/me')
      .set('Cookie', findSetCookie(newSession.headers, COOKIE_NAME) as string)
      .expect(200);
  });

  it('serializes competing attempts to remove the final active administrators', async () => {
    const displacedAdmins = await dataSource.query<
      { id: string; is_active: boolean }[]
    >(
      `SELECT id, is_active
       FROM users
       WHERE role = 'admin'::users_role_enum
         AND id <> ALL($1::uuid[])`,
      [[raceAdminAId, raceAdminBId]],
    );
    await dataSource.query(
      `UPDATE users
       SET role = 'staff'::users_role_enum
       WHERE role = 'admin'::users_role_enum
         AND id <> ALL($1::uuid[])`,
      [[raceAdminAId, raceAdminBId]],
    );
    await dataSource.query(
      `UPDATE users
       SET role = 'admin'::users_role_enum, is_active = true
       WHERE id = ANY($1::uuid[])`,
      [[raceAdminAId, raceAdminBId]],
    );

    try {
      const responses = await Promise.all([
        api()
          .patch(`/api/admin/users/${raceAdminBId}/status`)
          .set('Cookie', raceAdminACookie)
          .send({ isActive: false }),
        api()
          .patch(`/api/admin/users/${raceAdminAId}/status`)
          .set('Cookie', raceAdminBCookie)
          .send({ isActive: false }),
      ]);

      const statuses = responses.map(({ status }) => status);
      expect(statuses.filter((status) => status === 200)).toHaveLength(1);
      expect(
        statuses.filter((status) => status === 400 || status === 401),
      ).toHaveLength(1);
      const [{ count }] = await dataSource.query<{ count: string }[]>(
        `SELECT count(*)::text AS count
         FROM users
         WHERE role = 'admin'::users_role_enum AND is_active = true`,
      );
      expect(count).toBe('1');
    } finally {
      for (const user of displacedAdmins) {
        await dataSource.query(
          `UPDATE users
           SET role = 'admin'::users_role_enum, is_active = $2
           WHERE id = $1`,
          [user.id, user.is_active],
        );
      }
      await dataSource.query(
        `UPDATE users SET role = 'admin'::users_role_enum, is_active = true
         WHERE id = ANY($1::uuid[])`,
        [[raceAdminAId, raceAdminBId]],
      );
    }
  });

  it('returns 404 for an unknown target', async () => {
    await api()
      .patch('/api/admin/users/99999999-9999-4999-8999-999999999999/status')
      .set('Cookie', adminCookie)
      .send({ isActive: false })
      .expect(404);
  });
});
