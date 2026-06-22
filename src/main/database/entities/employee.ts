import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Company } from './company'

@Entity()
export class Employee {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: 'nvarchar', length: 255 })
    name!: string

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    address?: string

    @ManyToOne(() => Company)
    company!: Company
}
