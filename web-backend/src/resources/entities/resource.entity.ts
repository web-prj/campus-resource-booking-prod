import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Building } from './building.entity';

/** A bookable room on campus. */
@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_resources_code', { unique: true })
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'room' })
  type: string;

  @Column({ type: 'integer' })
  capacity: number;

  @Column({ type: 'varchar', length: 120 })
  location: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  amenities: string[];

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @ManyToOne(() => Building, (building) => building.resources)
  @JoinColumn({ name: 'building_id' })
  building: Building;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
