import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "./company";

@Entity()
export class BankTransaction {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    date!: string;

    @Column({ type: 'real' })
    amount!: number;

    @Column({ type: 'text' })
    currency!: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ type: 'text', nullable: true })
    counterpartyName?: string;

    @Column({ type: 'text', nullable: true })
    counterpartyIban?: string;

    @Column({ type: 'text', nullable: true })
    variableSymbol?: string;

    @Column({ type: 'text', nullable: true })
    constantSymbol?: string;

    @Column({ type: 'text', nullable: true })
    specificSymbol?: string;

    @Column({ type: 'text', nullable: true })
    note?: string;

    @Column({ type: 'integer', nullable: true })
    linkedInvoiceId?: number;

    @Column({ type: 'integer', nullable: true })
    bankAccountId?: number;

    @ManyToOne(() => Company)
    company!: Company;
}
