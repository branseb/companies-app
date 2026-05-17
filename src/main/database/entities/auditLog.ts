import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class AuditLog {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "nvarchar", length: 50, default: "" })
    companyIco!: string;

    @Column({ type: "nvarchar", length: 100 })
    action!: string;

    @Column({ type: "nvarchar", length: 100 })
    entityType!: string;

    @Column({ type: "int", nullable: true })
    entityId!: number | null;

    @Column({ type: "nvarchar", length: "MAX", nullable: true })
    details!: string | null;

    @CreateDateColumn({ type: "datetime2" })
    createdAt!: Date;
}
