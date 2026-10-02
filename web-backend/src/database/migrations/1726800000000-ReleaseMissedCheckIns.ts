import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a confirmed booking become a no-show 15 minutes after its start, when
 * nobody checked in, instead of only after its end; and lets the release job
 * record that no-show without a staff actor.
 */
export class ReleaseMissedCheckIns1726800000000 implements MigrationInterface {
  name = 'ReleaseMissedCheckIns1726800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_no_show_timeline",
        DROP CONSTRAINT "CHK_bookings_no_show_state",
        ADD CONSTRAINT "CHK_bookings_no_show_timeline"
          CHECK (
            "no_show_at" IS NULL
            OR "no_show_at" >=
              (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
                + INTERVAL '15 minutes'
          ),
        ADD CONSTRAINT "CHK_bookings_no_show_state"
          CHECK (
            ("status" = 'no_show' AND "no_show_at" IS NOT NULL)
            OR ("status" <> 'no_show'
              AND "no_show_at" IS NULL
              AND "no_show_by_id" IS NULL)
          )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const incompatible = (await queryRunner.query(`
      SELECT "id"
      FROM "bookings"
      WHERE "status" = 'no_show'
        AND ("no_show_by_id" IS NULL
          OR "no_show_at" <
            (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh'))
      LIMIT 10
    `)) as unknown as { id: string }[];
    if (incompatible.length) {
      throw new Error(
        `Cannot revert missed check-in release while released or early no-show bookings exist: ${incompatible
          .map(({ id }) => id)
          .join(', ')}`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_no_show_state",
        DROP CONSTRAINT "CHK_bookings_no_show_timeline",
        ADD CONSTRAINT "CHK_bookings_no_show_timeline"
          CHECK (
            "no_show_at" IS NULL
            OR "no_show_at" >=
              (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
          ),
        ADD CONSTRAINT "CHK_bookings_no_show_state"
          CHECK (
            ("status" = 'no_show'
              AND "no_show_at" IS NOT NULL
              AND "no_show_by_id" IS NOT NULL)
            OR ("status" <> 'no_show'
              AND "no_show_at" IS NULL
              AND "no_show_by_id" IS NULL)
          )
    `);
  }
}
