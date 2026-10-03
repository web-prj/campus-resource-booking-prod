import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A student account. Students can sign up and log in (see the auth module),
 * and each booking belongs to the user who made it.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName: string;

  // The hashed password (never the plain text). `select: false` keeps it out
  // of normal queries; only the login check asks for it explicitly.
  // It is null for the seeded student, who has no password.
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
