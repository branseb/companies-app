import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Company } from './company'

@Entity()
export class Receipt {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    ekasaId?: string

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    ekasaDataJson?: string

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    photoPath?: string

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    notes?: string

    @Column({ type: 'nvarchar', length: 'max' })
    createdAt!: string

    @ManyToOne(() => Company)
    company!: Company
}
