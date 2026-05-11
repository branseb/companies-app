import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class Company {
    @PrimaryColumn({ type: 'text' })
    id!: string;

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
}