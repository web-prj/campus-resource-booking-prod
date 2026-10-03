import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a password column so students can sign up and log in.
 * It is nullable because the seeded student was created without a password
 * (that account simply cannot log in). No existing data is changed.
 */
export class AddUserPassword1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);
  }
}
