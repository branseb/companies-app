import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Company {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    name!: string;

    @Column({ type: 'text' })
    ico!: string;

    @Column({ nullable: true, type: 'text' })
    dic?: string;

    @Column({ nullable: true, type: 'text' })
    address?: string;

    @Column({ nullable: true, type: 'text' })
    city?: string;

    @Column({ nullable: true, type: 'text' })
    icDph?: string;

    @Column({ nullable: true, type: 'text' })
    zip?: string;

    @Column({ nullable: true, type: 'text' })
    country?: string;

    @Column({ nullable: true, type: 'text' })
    email?: string;

    @Column({ nullable: true, type: 'text' })
    phone?: string;
}