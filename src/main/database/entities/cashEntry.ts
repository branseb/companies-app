import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "./company";

@Entity()
export class CashEntry {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    date!: string;

    @Column({ type: 'real' })
    amount!: number;

    @Column({ type: 'text', default: 'EUR' })
    currency!: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ type: 'text', nullable: true })
    note?: string;

    @Column({ type: 'integer', nullable: true })
    cashRegisterId?: number;

    @Column({ type: 'integer', nullable: true })
    linkedInvoiceId?: number;

    @Column({ type: 'integer', nullable: true })
    pairedBankTransactionId?: number;

    @ManyToOne(() => Company)
    company!: Company;
}
