import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "./company";

@Entity()
export class BankAccount {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'nvarchar', length: 'max' })
    name!: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    iban?: string;

    @Column({ type: 'nvarchar', length: 'max', default: 'EUR' })
    currency!: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    note?: string;

    @ManyToOne(() => Company)
    company!: Company;
}
