import { MigrationInterface, QueryRunner } from 'typeorm';

const PREVIOUS_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'completed',
  'no_show',
  'rejected',
  'cancelled',
];

/**
 * Adds the `expired` booking status: a request nobody reviewed by its check-in
 * deadline. It is outside the exclusion constraint's blocking statuses, so an
 * expired request no longer holds its slot.
 */
export class ExpireUnreviewedRequests1726900000000 implements MigrationInterface {
  name = 'ExpireUnreviewedRequests1726900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adding a value keeps the type, so no constraint or index needs
    // rebuilding. The value is not used in this transaction.
    await queryRunner.query(
      `ALTER TYPE "bookings_status_enum" ADD VALUE IF NOT EXISTS 'expired'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT count(*)::text AS count FROM "bookings" WHERE "status"::text = 'expired'`,
    )) as { count: string }[];
    if (count !== '0') {
      throw new Error(
        'Cannot revert expired booking requests while expired bookings exist',
      );
    }

    // PostgreSQL cannot drop an enum value, so rebuild the type. Every
    // constraint and index that mentions the status is captured verbatim,
    // dropped, and recreated against the rebuilt type.
    const constraints = (await queryRunner.query(`
      SELECT conname AS name, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = '"bookings"'::regclass
        AND contype IN ('c', 'x')
        AND pg_get_constraintdef(oid) LIKE '%bookings_status_enum%'
    `)) as { name: string; definition: string }[];
    const indexes = (await queryRunner.query(`
      SELECT index_class.relname AS name,
        pg_get_indexdef(index_class.oid) AS definition
      FROM pg_index
      JOIN pg_class index_class ON index_class.oid = pg_index.indexrelid
      WHERE pg_index.indrelid = '"bookings"'::regclass
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE pg_constraint.conindid = pg_index.indexrelid
        )
        AND pg_get_indexdef(index_class.oid) LIKE '%bookings_status_enum%'
    `)) as { name: string; definition: string }[];

    for (const { name } of constraints) {
      await queryRunner.query(
        `ALTER TABLE "bookings" DROP CONSTRAINT "${name}"`,
      );
    }
    for (const { name } of indexes) {
      await queryRunner.query(`DROP INDEX "${name}"`);
    }
    await queryRunner.query(
      `ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_expired"`,
    );
    await queryRunner.query(
      `CREATE TYPE "bookings_status_enum" AS ENUM (${PREVIOUS_STATUSES.map(
        (status) => `'${status}'`,
      ).join(', ')})`,
    );
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ALTER COLUMN "status" TYPE "bookings_status_enum"
        USING "status"::text::"bookings_status_enum"
    `);
    for (const { name, definition } of constraints) {
      await queryRunner.query(
        `ALTER TABLE "bookings" ADD CONSTRAINT "${name}" ${definition}`,
      );
    }
    for (const { definition } of indexes) {
      await queryRunner.query(definition);
    }
    await queryRunner.query(`DROP TYPE "bookings_status_enum_expired"`);
  }
}
