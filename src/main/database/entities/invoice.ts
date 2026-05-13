import {
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn
} from "typeorm";
import { Company } from "./company";

@Entity()
export class Invoice {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    invoiceNumber!: string;

    @Column({ type: 'text' })
    issueDate!: string;

    @Column({ type: 'text', nullable: true })
    dueDate?: string;

    @Column({ type: 'text', nullable: true })
    deliveryDate?: string;

    @Column({ type: 'text' })
    currency!: string;

    @Column({ type: 'text' })
    items!: string;

    @Column({ type: 'text' })
    supplierIco!: string;

    @Column({ type: 'text', nullable: true })
    customerIco?: string;

    @Column({ type: 'text' })
    supplier!: string;

    @Column({ type: 'text' })
    customer!: string;

    @Column({ type: 'boolean', default: false })
    paid!: boolean;

    @Column({ type: 'text', nullable: true })
    paidDate?: string;

    @ManyToOne(() => Company)
    company!: Company;
}