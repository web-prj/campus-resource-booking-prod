import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Collapses the schema to student-only room booking.
 *
 * Removes staff approval, admin review, manual check-in/out, user roles, and
 * every resource type other than "room". The booking lifecycle becomes simply
 * confirmed, with cancelled as the only other state.
 *
 * DATA IMPACT (destructive, not restored by down()):
 *  - bookings on non-room resources are deleted;
 *  - non-room resources (and their closures) are deleted;
 *  - pending bookings become confirmed (approval no longer exists);
 *  - rejected and expired bookings are deleted (they held no slot).
 * down() restores the schema shape only.
 */
export class SimplifyToStudentRoomBooking1727300000000 implements MigrationInterface {
  name = 'SimplifyToStudentRoomBooking1727300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1. Data cleanup ---------------------------------------------------
    await queryRunner.query(`
      DELETE FROM "bookings"
      WHERE "resource_id" IN (
        SELECT "id" FROM "resources" WHERE "type" <> 'room'
      )
    `);
    await queryRunner.query(`
      DELETE FROM "resource_closures"
      WHERE "resource_id" IN (
        SELECT "id" FROM "resources" WHERE "type" <> 'room'
      )
    `);
    await queryRunner.query(`DELETE FROM "resources" WHERE "type" <> 'room'`);

    await queryRunner.query(
      `UPDATE "bookings" SET "status" = 'confirmed' WHERE "status" = 'pending'`,
    );
    await queryRunner.query(
      `DELETE FROM "bookings" WHERE "status" IN ('rejected', 'expired')`,
    );

    // --- 2. Drop booking objects that depend on removed columns/statuses ---
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "FK_bookings_reviewed_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "FK_bookings_checked_in_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "FK_bookings_checked_out_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "FK_bookings_no_show_by_id"`,
    );

    for (const constraint of [
      'CHK_bookings_cancellation_state',
      'CHK_bookings_pending_unreviewed',
      'CHK_bookings_review_pair',
      'CHK_bookings_rejection_state',
      'CHK_bookings_rejection_reason_content',
      'CHK_bookings_check_in_request',
      'CHK_bookings_check_in_timeline',
      'CHK_bookings_checked_in_state',
      'CHK_bookings_checkout_state',
      'CHK_bookings_no_show_state',
      'CHK_bookings_no_show_timeline',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "${constraint}"`,
      );
    }

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bookings_analytics_date_status_resource"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bookings_pending_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bookings_operations_date_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "EXCL_bookings_resource_period_blocking"`,
    );

    // --- 3. Drop removed booking columns -----------------------------------
    for (const column of [
      'reviewed_at',
      'reviewed_by_id',
      'rejection_reason',
      'check_in_code',
      'check_in_requested_at',
      'checked_in_at',
      'checked_in_by_id',
      'checked_out_at',
      'checked_out_by_id',
      'no_show_at',
      'no_show_by_id',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "bookings" DROP COLUMN IF EXISTS "${column}"`,
      );
    }

    // --- 4. Narrow the booking status enum ---------------------------------
    await queryRunner.query(
      `ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "bookings_status_enum" AS ENUM ('confirmed', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "bookings_status_enum" USING "status"::text::"bookings_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "bookings_status_enum_old"`);

    // --- 5. Recreate the blocking exclusion and cancellation check ---------
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "EXCL_bookings_resource_period_blocking"
        EXCLUDE USING gist ("resource_id" WITH =, "booking_period" WITH &&)
        WHERE ("status" = 'confirmed')
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_cancellation_state"
        CHECK (
          ("status" = 'cancelled' AND "cancelled_at" IS NOT NULL)
          OR ("status" <> 'cancelled' AND "cancelled_at" IS NULL)
        )
    `);

    // --- 6. Resources: drop approval flag, narrow type to room -------------
    await queryRunner.query(
      `ALTER TABLE "resources" DROP COLUMN IF EXISTS "requires_approval"`,
    );
    await queryRunner.query(
      `ALTER TYPE "resources_type_enum" RENAME TO "resources_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "resources_type_enum" AS ENUM ('room')`,
    );
    await queryRunner.query(
      `ALTER TABLE "resources" ALTER COLUMN "type" TYPE "resources_type_enum" USING "type"::text::"resources_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "resources_type_enum_old"`);

    // --- 7. Users: drop the role concept entirely --------------------------
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_role_active"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }

  /**
   * Restores the schema shape (columns, enums, constraints, indexes). It does
   * NOT restore rows deleted by up() (non-room resources, their bookings, or
   * rejected/expired bookings) and cannot distinguish bookings that were
   * originally pending from those created confirmed.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // --- Users: restore the role column ------------------------------------
    await queryRunner.query(
      `CREATE TYPE "users_role_enum" AS ENUM ('student', 'staff', 'admin')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "role" "users_role_enum" NOT NULL DEFAULT 'student'`,
    );
    await queryRunner.query(`
      CREATE INDEX "IDX_users_role_active" ON "users" ("role", "is_active")
    `);

    // --- Resources: widen type, restore approval flag ----------------------
    await queryRunner.query(
      `ALTER TYPE "resources_type_enum" RENAME TO "resources_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "resources_type_enum" AS ENUM ('room', 'laboratory', 'equipment')`,
    );
    await queryRunner.query(
      `ALTER TABLE "resources" ALTER COLUMN "type" TYPE "resources_type_enum" USING "type"::text::"resources_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "resources_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "resources" ADD COLUMN "requires_approval" boolean NOT NULL DEFAULT false`,
    );

    // --- Bookings: drop the simplified index/exclusion/checks --------------
    for (const constraint of [
      'CHK_bookings_no_show_state',
      'CHK_bookings_no_show_timeline',
      'CHK_bookings_checked_in_state',
      'CHK_bookings_cancellation_state',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "${constraint}"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "EXCL_bookings_resource_period_blocking"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bookings_operations_date_status"`,
    );

    // --- Bookings: re-add the removed columns ------------------------------
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "checked_in_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "no_show_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "reviewed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "reviewed_by_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "rejection_reason" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "check_in_code" character varying(6)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "check_in_requested_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "checked_in_by_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "checked_out_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "checked_out_by_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "no_show_by_id" uuid`,
    );

    // --- Bookings: widen the status enum -----------------------------------
    await queryRunner.query(
      `ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "bookings_status_enum" AS ENUM ('pending', 'confirmed', 'checked_in', 'completed', 'no_show', 'rejected', 'cancelled', 'expired')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "bookings_status_enum" USING "status"::text::"bookings_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "bookings_status_enum_old"`);

    // --- Bookings: restore FKs ---------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_reviewed_by_id"
        FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_checked_in_by_id"
        FOREIGN KEY ("checked_in_by_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_checked_out_by_id"
        FOREIGN KEY ("checked_out_by_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_no_show_by_id"
        FOREIGN KEY ("no_show_by_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // --- Bookings: restore indexes -----------------------------------------
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_analytics_date_status_resource"
        ON "bookings" ("booking_date", "status", "resource_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_pending_created_at"
        ON "bookings" ("created_at") WHERE "status" = 'pending'
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_operations_date_status"
        ON "bookings" ("booking_date", "start_time", "status")
        WHERE "status" IN ('confirmed', 'checked_in')
    `);

    // --- Bookings: restore the original check constraints ------------------
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_cancellation_state"
        CHECK (
          ("status" = 'cancelled' AND "cancelled_at" IS NOT NULL)
          OR ("status" <> 'cancelled' AND "cancelled_at" IS NULL)
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_pending_unreviewed"
        CHECK ("status" <> 'pending' OR "reviewed_at" IS NULL)
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_review_pair"
        CHECK (
          ("reviewed_at" IS NULL AND "reviewed_by_id" IS NULL)
          OR ("reviewed_at" IS NOT NULL AND "reviewed_by_id" IS NOT NULL)
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_rejection_state"
        CHECK (
          ("status" = 'rejected' AND "rejection_reason" IS NOT NULL AND "reviewed_at" IS NOT NULL)
          OR ("status" <> 'rejected' AND "rejection_reason" IS NULL)
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_rejection_reason_content"
        CHECK (
          "status" <> 'rejected'
          OR char_length(btrim("rejection_reason")) BETWEEN 3 AND 500
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_check_in_request"
        CHECK (
          "check_in_code" IS NULL
          AND ("check_in_requested_at" IS NULL OR "status" IN ('confirmed', 'checked_in', 'completed', 'no_show'))
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_check_in_timeline"
        CHECK (
          ("check_in_requested_at" IS NULL OR ("check_in_requested_at" >= (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '15 minutes' AND "check_in_requested_at" < ("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh'))
          AND ("checked_in_at" IS NULL OR (("check_in_requested_at" IS NULL OR "checked_in_at" >= "check_in_requested_at") AND "checked_in_at" >= (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '15 minutes' AND "checked_in_at" < ("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh'))
          AND ("checked_out_at" IS NULL OR "checked_out_at" >= "checked_in_at")
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_no_show_timeline"
        CHECK (
          "no_show_at" IS NULL
          OR "no_show_at" >= (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_checked_in_state"
        CHECK (
          ("status" IN ('checked_in', 'completed') AND "checked_in_at" IS NOT NULL AND "checked_in_by_id" IS NOT NULL)
          OR ("status" NOT IN ('checked_in', 'completed') AND "checked_in_at" IS NULL AND "checked_in_by_id" IS NULL)
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_checkout_state"
        CHECK (
          ("status" = 'completed' AND "checked_out_at" IS NOT NULL AND "checked_out_by_id" IS NOT NULL)
          OR ("status" <> 'completed' AND "checked_out_at" IS NULL AND "checked_out_by_id" IS NULL)
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_no_show_state"
        CHECK (
          ("status" = 'no_show' AND "no_show_at" IS NOT NULL)
          OR ("status" <> 'no_show' AND "no_show_at" IS NULL AND "no_show_by_id" IS NULL)
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "EXCL_bookings_resource_period_blocking"
        EXCLUDE USING gist ("resource_id" WITH =, "booking_period" WITH &&)
        WHERE ("status" IN ('pending', 'confirmed', 'checked_in'))
    `);
  }
}
