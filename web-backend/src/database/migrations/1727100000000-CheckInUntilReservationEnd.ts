import { MigrationInterface, QueryRunner } from 'typeorm';

/** Keep historical arrivals intact; new no-shows cannot precede the booked end. */
export class CheckInUntilReservationEnd1727100000000 implements MigrationInterface {
  name = 'CheckInUntilReservationEnd1727100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_no_show_timeline",
        ADD CONSTRAINT "CHK_bookings_no_show_timeline"
          CHECK ("no_show_at" IS NULL OR "no_show_at" >=
            (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh'))
          NOT VALID
    `);
    // Old no-shows may predate the end. NOT VALID preserves them while
    // enforcing the new rule on writes. Historical early check-ins must remain
    // eligible for checkout under the existing timeline constraint.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_no_show_timeline",
        ADD CONSTRAINT "CHK_bookings_no_show_timeline"
          CHECK ("no_show_at" IS NULL OR "no_show_at" >=
            (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
              + INTERVAL '15 minutes')
    `);
  }
}
