import { MigrationInterface, QueryRunner } from 'typeorm';

export class RevokeDeactivatedSessions1727200000000 implements MigrationInterface {
  name = 'RevokeDeactivatedSessions1727200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "session_version" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "session_version"`,
    );
  }
}
