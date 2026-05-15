import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "./company";

@Entity()
export class CashEntry {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'nvarchar', length: 'max' })
    date!: string;

    @Column({ type: 'float' })
    amount!: number;

    @Column({ type: 'nvarchar', length: 'max', default: 'EUR' })
    currency!: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    description?: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    note?: string;

    @Column({ type: 'int', nullable: true })
    cashRegisterId?: number;

    @Column({ type: 'int', nullable: true })
    linkedInvoiceId?: number;

    @Column({ type: 'int', nullable: true })
    pairedBankTransactionId?: number;

    @ManyToOne(() => Company)
    company!: Company;
}
