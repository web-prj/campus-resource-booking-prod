import { MigrationInterface, QueryRunner } from 'typeorm';

/** Retain request timestamps for history, but retire every outstanding code. */
export class ManualStaffCheckIn1727000000000 implements MigrationInterface {
  name = 'ManualStaffCheckIn1727000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_check_in_request",
        DROP CONSTRAINT "CHK_bookings_check_in_timeline",
        DROP CONSTRAINT "CHK_bookings_checked_in_state"
    `);
    await queryRunner.query(`
      UPDATE "bookings" SET "check_in_code" = NULL
      WHERE "check_in_code" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD CONSTRAINT "CHK_bookings_check_in_request"
          CHECK ("check_in_code" IS NULL AND (
            "check_in_requested_at" IS NULL
            OR "status" IN ('confirmed', 'checked_in', 'completed', 'no_show')
          )),
        ADD CONSTRAINT "CHK_bookings_check_in_timeline"
          CHECK (
            ("check_in_requested_at" IS NULL OR (
              "check_in_requested_at" >=
                (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
                  - INTERVAL '15 minutes'
              AND "check_in_requested_at" <
                (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
            ))
            AND ("checked_in_at" IS NULL OR (
              ("check_in_requested_at" IS NULL
                OR "checked_in_at" >= "check_in_requested_at")
              AND "checked_in_at" >=
                (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
                  - INTERVAL '15 minutes'
              AND "checked_in_at" <
                (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
            ))
            AND ("checked_out_at" IS NULL
              OR "checked_out_at" >= "checked_in_at")
          ),
        ADD CONSTRAINT "CHK_bookings_checked_in_state"
          CHECK (
            ("status" IN ('checked_in', 'completed')
              AND "checked_in_at" IS NOT NULL
              AND "checked_in_by_id" IS NOT NULL)
            OR ("status" NOT IN ('checked_in', 'completed')
              AND "checked_in_at" IS NULL
              AND "checked_in_by_id" IS NULL)
          )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting would require recovering deleted codes or inventing requests.
    const incompatible = (await queryRunner.query(`
      SELECT "id" FROM "bookings"
      WHERE ("status" = 'confirmed' AND "check_in_requested_at" IS NOT NULL)
        OR ("status" IN ('checked_in', 'completed')
          AND "check_in_requested_at" IS NULL)
      LIMIT 10
    `)) as { id: string }[];
    if (incompatible.length) {
      throw new Error(
        `Cannot revert manual check-in with incompatible bookings: ${incompatible.map(({ id }) => id).join(', ')}`,
      );
    }
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_checked_in_state",
        DROP CONSTRAINT "CHK_bookings_check_in_timeline",
        DROP CONSTRAINT "CHK_bookings_check_in_request",
        ADD CONSTRAINT "CHK_bookings_check_in_request"
          CHECK (
            ("check_in_requested_at" IS NULL AND "check_in_code" IS NULL)
            OR ("check_in_requested_at" IS NOT NULL AND (
              ("status" = 'confirmed' AND "check_in_code" ~ '^[0-9]{6}$')
              OR ("status" IN ('checked_in', 'completed', 'no_show')
                AND "check_in_code" IS NULL)
            ))
          ),
        ADD CONSTRAINT "CHK_bookings_check_in_timeline"
          CHECK (
            ("check_in_requested_at" IS NULL OR (
              "check_in_requested_at" >=
                (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
                  - INTERVAL '15 minutes'
              AND "check_in_requested_at" <
                (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
            ))
            AND ("checked_in_at" IS NULL OR (
              "check_in_requested_at" IS NOT NULL
              AND "checked_in_at" >= "check_in_requested_at"
              AND "checked_in_at" >=
                (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
                  - INTERVAL '15 minutes'
              AND "checked_in_at" <
                (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
            ))
            AND ("checked_out_at" IS NULL
              OR "checked_out_at" >= "checked_in_at")
          ),
        ADD CONSTRAINT "CHK_bookings_checked_in_state"
          CHECK (
            ("status" IN ('checked_in', 'completed')
              AND "check_in_requested_at" IS NOT NULL
              AND "checked_in_at" IS NOT NULL
              AND "checked_in_by_id" IS NOT NULL)
            OR ("status" NOT IN ('checked_in', 'completed')
              AND "checked_in_at" IS NULL
              AND "checked_in_by_id" IS NULL)
          )
    `);
  }
}
