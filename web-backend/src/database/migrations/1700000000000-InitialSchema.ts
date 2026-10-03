import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the whole database schema (users, buildings, rooms, bookings) and
 * seeds one student, two buildings, and six rooms to start with.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // gen_random_uuid() lives in the pgcrypto extension.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL UNIQUE,
        "full_name" varchar(120) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "buildings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(20) NOT NULL UNIQUE,
        "name" varchar(120) NOT NULL,
        "address" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resources" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(30) NOT NULL UNIQUE,
        "name" varchar(120) NOT NULL,
        "description" text,
        "type" varchar(20) NOT NULL DEFAULT 'room',
        "capacity" integer NOT NULL,
        "location" varchar(120) NOT NULL,
        "amenities" text[] NOT NULL DEFAULT '{}',
        "building_id" uuid NOT NULL REFERENCES "buildings" ("id"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE TYPE "bookings_status_enum" AS ENUM ('confirmed', 'cancelled')`,
    );

    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "resource_id" uuid NOT NULL REFERENCES "resources" ("id"),
        "requester_id" uuid NOT NULL REFERENCES "users" ("id"),
        "booking_date" date NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "status" "bookings_status_enum" NOT NULL,
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // --- Seed data -------------------------------------------------------

    await queryRunner.query(`
      INSERT INTO "users" ("id", "email", "full_name") VALUES
        ('00000000-0000-4000-8000-000000000001', 'student@usth.edu.vn', 'Student')
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "buildings" ("id", "code", "name", "address") VALUES
        ('11111111-1111-4111-8111-111111111111', 'ALP', 'Alpha Building', '1 Alpha Road'),
        ('22222222-2222-4222-8222-222222222222', 'BET', 'Beta Building', '2 Beta Road')
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "resources"
        ("id", "code", "name", "description", "capacity", "location", "amenities", "building_id")
      VALUES
        ('aaaa0001-0000-4000-8000-000000000001', 'ALP-101', 'Room 101', 'Small study room', 6, 'First floor', '{whiteboard}', '11111111-1111-4111-8111-111111111111'),
        ('aaaa0001-0000-4000-8000-000000000002', 'ALP-102', 'Room 102', 'Meeting room', 10, 'First floor', '{whiteboard,projector}', '11111111-1111-4111-8111-111111111111'),
        ('aaaa0001-0000-4000-8000-000000000003', 'ALP-201', 'Room 201', 'Lecture room', 40, 'Second floor', '{projector,microphone}', '11111111-1111-4111-8111-111111111111'),
        ('bbbb0001-0000-4000-8000-000000000001', 'BET-101', 'Room 101', 'Computer lab', 24, 'First floor', '{computers,projector}', '22222222-2222-4222-8222-222222222222'),
        ('bbbb0001-0000-4000-8000-000000000002', 'BET-102', 'Room 102', 'Group study room', 8, 'First floor', '{whiteboard}', '22222222-2222-4222-8222-222222222222'),
        ('bbbb0001-0000-4000-8000-000000000003', 'BET-201', 'Room 201', 'Seminar room', 30, 'Second floor', '{projector}', '22222222-2222-4222-8222-222222222222')
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "bookings_status_enum"`);
    await queryRunner.query(`DROP TABLE "resources"`);
    await queryRunner.query(`DROP TABLE "buildings"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
