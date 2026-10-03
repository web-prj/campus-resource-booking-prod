import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A student. Authentication was removed for this assignment, so the app runs
 * as a single seeded student (see users.constants.ts). The table is kept only
 * so bookings can reference an owner.
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
