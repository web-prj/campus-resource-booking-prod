import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ManualStaffCheckIn1727000000000 } from '../src/database/migrations/1727000000000-ManualStaffCheckIn';

jest.setTimeout(15_000);

describe('manual staff check-in upgrade (e2e)', () => {
  it('retires an outstanding old code while preserving past check-in history', async () => {
    // A session-local table models the preceding migration's check-in columns.
    // Never revert or reset the shared test database just to test an upgrade.
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const config = module.get(ConfigService);
    const dataSource = new DataSource({
      type: 'postgres',
      host: config.getOrThrow<string>('database.host'),
      port: config.getOrThrow<number>('database.port'),
      username: config.getOrThrow<string>('database.username'),
      password: config.getOrThrow<string>('database.password'),
      database: config.getOrThrow<string>('database.database'),
      synchronize: false,
    });
    await dataSource.initialize();
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query(`
        CREATE TEMP TABLE "bookings" (
          "id" integer PRIMARY KEY,
          "status" text NOT NULL,
          "booking_date" date NOT NULL,
          "start_time" time NOT NULL,
          "end_time" time NOT NULL,
          "check_in_code" varchar(6),
          "check_in_requested_at" timestamptz,
          "checked_in_at" timestamptz,
          "checked_in_by_id" uuid,
          "checked_out_at" timestamptz,
          CONSTRAINT "CHK_bookings_check_in_request"
            CHECK (("check_in_requested_at" IS NULL AND "check_in_code" IS NULL)
              OR ("check_in_requested_at" IS NOT NULL AND
                (("status" = 'confirmed' AND "check_in_code" ~ '^[0-9]{6}$')
                  OR ("status" IN ('checked_in', 'completed', 'no_show') AND "check_in_code" IS NULL)))),
          CONSTRAINT "CHK_bookings_check_in_timeline"
            CHECK ("checked_in_at" IS NULL OR "checked_in_at" >= "check_in_requested_at"),
          CONSTRAINT "CHK_bookings_checked_in_state"
            CHECK (("status" IN ('checked_in', 'completed') AND "checked_in_at" IS NOT NULL
              AND "checked_in_by_id" IS NOT NULL)
              OR ("status" NOT IN ('checked_in', 'completed') AND "checked_in_at" IS NULL
                AND "checked_in_by_id" IS NULL))
        ) ON COMMIT DROP
      `);
      await runner.query(`
        INSERT INTO "bookings" ("id", "status", "booking_date", "start_time", "end_time",
          "check_in_code", "check_in_requested_at", "checked_in_at", "checked_in_by_id")
        VALUES
          (1, 'confirmed', '2099-01-20', '09:00', '10:00', '482193', '2099-01-20T01:50:00Z', NULL, NULL),
          (2, 'checked_in', '2099-01-20', '09:00', '10:00', NULL, '2099-01-20T01:50:00Z',
            '2099-01-20T02:00:00Z', '30000000-0000-4000-8000-000000000001')
      `);
      await new ManualStaffCheckIn1727000000000().up(runner);
      const rows = (await runner.query(`
        SELECT "id", "status", "check_in_code", "check_in_requested_at", "checked_in_at", "checked_in_by_id"
        FROM "bookings" ORDER BY "id"
      `)) as {
        id: number;
        status: string;
        check_in_code: string | null;
        check_in_requested_at: Date | null;
        checked_in_at: Date | null;
        checked_in_by_id: string | null;
      }[];
      expect(rows).toMatchObject([
        {
          id: 1,
          status: 'confirmed',
          check_in_code: null,
          checked_in_at: null,
        },
        {
          id: 2,
          status: 'checked_in',
          check_in_code: null,
          checked_in_by_id: '30000000-0000-4000-8000-000000000001',
        },
      ]);
      expect(rows[0].check_in_requested_at).toEqual(
        new Date('2099-01-20T01:50:00Z'),
      );
      expect(rows[1].checked_in_at).toEqual(new Date('2099-01-20T02:00:00Z'));

      // The upgraded constraints permit a staff-recorded arrival without any
      // student code or request timestamp, and forbid new codes.
      await runner.query(`
        UPDATE "bookings" SET "status" = 'checked_in', "checked_in_at" = '2099-01-20T02:05:00Z',
          "checked_in_by_id" = '30000000-0000-4000-8000-000000000001',
          "check_in_requested_at" = NULL WHERE "id" = 1
      `);
      const [checkedIn] = (await runner.query(`
        SELECT "status", "check_in_code", "check_in_requested_at" FROM "bookings" WHERE "id" = 1
      `)) as {
        status: string;
        check_in_code: string | null;
        check_in_requested_at: Date | null;
      }[];
      expect(checkedIn).toEqual({
        status: 'checked_in',
        check_in_code: null,
        check_in_requested_at: null,
      });
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
      await dataSource.destroy();
      await module.close();
    }
  });
});
