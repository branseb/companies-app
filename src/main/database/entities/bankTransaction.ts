import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "./company";

@Entity()
export class BankTransaction {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'nvarchar', length: 'max' })
    date!: string;

    @Column({ type: 'float' })
    amount!: number;

    @Column({ type: 'nvarchar', length: 'max' })
    currency!: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    description?: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    counterpartyName?: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    counterpartyIban?: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    variableSymbol?: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    constantSymbol?: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    specificSymbol?: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    note?: string;

    @Column({ type: 'int', nullable: true })
    linkedInvoiceId?: number;

    @Column({ type: 'int', nullable: true })
    bankAccountId?: number;

    @Column({ type: 'int', nullable: true })
    pairedCashEntryId?: number;

    @ManyToOne(() => Company)
    company!: Company;
}
