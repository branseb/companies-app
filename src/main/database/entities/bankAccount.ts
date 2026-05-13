import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "./company";

@Entity()
export class BankAccount {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    name!: string;

    @Column({ type: 'text', nullable: true })
    iban?: string;

    @Column({ type: 'text', default: 'EUR' })
    currency!: string;

    @Column({ type: 'text', nullable: true })
    note?: string;

    @ManyToOne(() => Company)
    company!: Company;
}
