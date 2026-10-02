import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CheckInUntilReservationEnd1727100000000 } from '../src/database/migrations/1727100000000-CheckInUntilReservationEnd';

jest.setTimeout(15_000);

describe('reservation-end no-show upgrade (e2e)', () => {
  it('preserves historical early no-shows but rejects new ones before the reservation ends', async () => {
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
    try {
      await dataSource.initialize();
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      try {
        await runner.startTransaction();
        await runner.query(`
          CREATE TEMP TABLE "bookings" (
            "id" integer PRIMARY KEY,
            "booking_date" date NOT NULL,
            "start_time" time NOT NULL,
            "end_time" time NOT NULL,
            "no_show_at" timestamptz,
            CONSTRAINT "CHK_bookings_no_show_timeline"
              CHECK ("no_show_at" IS NULL OR "no_show_at" >=
                (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
                  + INTERVAL '15 minutes')
          ) ON COMMIT DROP
        `);
        await runner.query(`
          INSERT INTO "bookings" VALUES
            (1, '2099-01-05', '09:00', '11:00', '2099-01-05T09:15:00+07:00')
        `);
        await new CheckInUntilReservationEnd1727100000000().up(runner);
        expect(
          (await runner.query('SELECT "id" FROM "bookings"')) as {
            id: number;
          }[],
        ).toEqual([{ id: 1 }]);
        const [constraint] = (await runner.query(`
          SELECT convalidated FROM pg_constraint
          WHERE conname = 'CHK_bookings_no_show_timeline'
            AND conrelid = 'pg_temp.bookings'::regclass
        `)) as { convalidated: boolean }[];
        expect(constraint.convalidated).toBe(false);
        await runner.query('SAVEPOINT before_invalid_no_show');
        await expect(
          runner.query(`
            INSERT INTO "bookings" VALUES
              (2, '2099-01-05', '09:00', '11:00', '2099-01-05T10:59:59+07:00')
          `),
        ).rejects.toMatchObject({
          code: '23514',
          constraint: 'CHK_bookings_no_show_timeline',
        });
        await runner.query('ROLLBACK TO SAVEPOINT before_invalid_no_show');
        await runner.query(`
          INSERT INTO "bookings" VALUES
            (3, '2099-01-05', '09:00', '11:00', '2099-01-05T11:00:00+07:00')
        `);
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    } finally {
      if (dataSource.isInitialized) await dataSource.destroy();
      await module.close();
    }
  });
});
