import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Authentication was removed for this assignment: the app runs as one seeded
 * student and no longer stores passwords or session state. This migration drops
 * the auth-only user columns and seeds a minimal, usable catalog (one student,
 * two buildings, a handful of rooms) so the app works without any seed scripts.
 *
 * down() restores the dropped columns with safe placeholder values but cannot
 * recover the original password hashes or session data.
 */
export class RemoveAuthAndSeedData1727400000000 implements MigrationInterface {
  name = 'RemoveAuthAndSeedData1727400000000';

  private static readonly STUDENT_ID = '00000000-0000-4000-8000-000000000001';
  private static readonly BUILDING_ALP = '11111111-1111-4111-8111-111111111111';
  private static readonly BUILDING_BET = '22222222-2222-4222-8222-222222222222';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Auth-only columns are no longer mapped by the User entity.
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "session_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "is_active"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash"`,
    );

    // The single student every booking is attributed to.
    await queryRunner.query(
      `INSERT INTO "users" ("id", "email", "full_name")
       VALUES ($1, 'default.student@usth.edu.vn', 'Student')
       ON CONFLICT DO NOTHING`,
      [RemoveAuthAndSeedData1727400000000.STUDENT_ID],
    );

    // Buildings.
    await queryRunner.query(
      `INSERT INTO "buildings" ("id", "code", "name", "address") VALUES
         ($1, 'ALP', 'Alpha Building', '1 Campus Road, Hanoi'),
         ($2, 'BET', 'Beta Building', '2 Campus Road, Hanoi')
       ON CONFLICT DO NOTHING`,
      [
        RemoveAuthAndSeedData1727400000000.BUILDING_ALP,
        RemoveAuthAndSeedData1727400000000.BUILDING_BET,
      ],
    );

    // Rooms (Mon–Fri, 08:00–18:00). gen_random_uuid() ships with PostgreSQL 13+.
    await queryRunner.query(
      `INSERT INTO "resources"
         ("code", "name", "description", "type", "status", "capacity",
          "location", "amenities", "operating_days", "opens_at", "closes_at",
          "building_id")
       VALUES
         ('ALP-101', 'Lecture Room A101', 'Ground-floor lecture room', 'room', 'active', 40,
          'Alpha Building, Floor 1', '{projector,whiteboard}', '{1,2,3,4,5}', '08:00:00', '18:00:00', $1),
         ('ALP-102', 'Seminar Room A102', 'Small seminar room', 'room', 'active', 20,
          'Alpha Building, Floor 1', '{whiteboard}', '{1,2,3,4,5}', '08:00:00', '18:00:00', $1),
         ('ALP-201', 'Meeting Room A201', 'Group meeting room', 'room', 'active', 10,
          'Alpha Building, Floor 2', '{tv,whiteboard}', '{1,2,3,4,5}', '08:00:00', '18:00:00', $1),
         ('BET-101', 'Lecture Room B101', 'Large lecture hall', 'room', 'active', 60,
          'Beta Building, Floor 1', '{projector,microphone}', '{1,2,3,4,5}', '08:00:00', '18:00:00', $2),
         ('BET-102', 'Study Room B102', 'Quiet study room', 'room', 'active', 8,
          'Beta Building, Floor 1', '{whiteboard}', '{1,2,3,4,5}', '08:00:00', '18:00:00', $2),
         ('BET-201', 'Computer Room B201', 'Computer lab room', 'room', 'active', 30,
          'Beta Building, Floor 2', '{computers,projector}', '{1,2,3,4,5,6}', '08:00:00', '18:00:00', $2)
       ON CONFLICT DO NOTHING`,
      [
        RemoveAuthAndSeedData1727400000000.BUILDING_ALP,
        RemoveAuthAndSeedData1727400000000.BUILDING_BET,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove seeded rows (bookings referencing the student must be gone first).
    await queryRunner.query(
      `DELETE FROM "resources" WHERE "building_id" IN ($1, $2)`,
      [
        RemoveAuthAndSeedData1727400000000.BUILDING_ALP,
        RemoveAuthAndSeedData1727400000000.BUILDING_BET,
      ],
    );
    await queryRunner.query(`DELETE FROM "buildings" WHERE "id" IN ($1, $2)`, [
      RemoveAuthAndSeedData1727400000000.BUILDING_ALP,
      RemoveAuthAndSeedData1727400000000.BUILDING_BET,
    ]);
    await queryRunner.query(`DELETE FROM "users" WHERE "id" = $1`, [
      RemoveAuthAndSeedData1727400000000.STUDENT_ID,
    ]);

    // Restore the dropped columns (data cannot be recovered).
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "password_hash" character varying(72) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "session_version" integer NOT NULL DEFAULT 0`,
    );
  }
}
