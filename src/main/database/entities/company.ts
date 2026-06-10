import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Company {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'nvarchar', length: 'max' })
    name!: string;

    @Column({ type: 'nvarchar', length: 'max' })
    ico!: string;

    @Column({ nullable: true, type: 'nvarchar', length: 'max' })
    dic?: string;

    @Column({ nullable: true, type: 'nvarchar', length: 'max' })
    address?: string;

    @Column({ nullable: true, type: 'nvarchar', length: 'max' })
    city?: string;

    @Column({ nullable: true, type: 'nvarchar', length: 'max' })
    icDph?: string;

    @Column({ nullable: true, type: 'nvarchar', length: 'max' })
    zip?: string;

    @Column({ nullable: true, type: 'nvarchar', length: 'max' })
    country?: string;

    @Column({ nullable: true, type: 'nvarchar', length: 'max' })
    email?: string;

    @Column({ nullable: true, type: 'nvarchar', length: 'max' })
    phone?: string;

    @Column({ nullable: true, type: 'nvarchar', length: 'max' })
    previousIcos?: string;
}
