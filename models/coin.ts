import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'coin' })
export class Coin {
    @PrimaryColumn({ type: 'bigint' })
    id: number;

    @PrimaryColumn({ type: 'varchar', length: 255 })
    coin_id: string;

    @Column({ type: 'decimal', precision: 20, scale: 10 })
    close: number;

    @Column({ type: 'decimal', precision: 20, scale: 10 })
    open: number;

    @Column({ type: 'decimal', precision: 20, scale: 10 })
    high: number;

    @Column({ type: 'decimal', precision: 20, scale: 10 })
    low: number;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;
}
