import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "./company";

@Entity()
export class Invoice {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'nvarchar', length: 'max' })
    invoiceNumber!: string;

    @Column({ type: 'nvarchar', length: 'max' })
    issueDate!: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    dueDate?: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    deliveryDate?: string;

    @Column({ type: 'nvarchar', length: 'max' })
    currency!: string;

    @Column({ type: 'nvarchar', length: 'max' })
    items!: string;

    @Column({ type: 'nvarchar', length: 'max' })
    supplierIco!: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    customerIco?: string;

    @Column({ type: 'nvarchar', length: 'max' })
    supplier!: string;

    @Column({ type: 'nvarchar', length: 'max' })
    customer!: string;

    @Column({ type: 'bit', default: false })
    paid!: boolean;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    paidDate?: string;

    @ManyToOne(() => Company)
    company!: Company;
}
