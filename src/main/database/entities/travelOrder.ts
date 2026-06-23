import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Company } from './company'

@Entity()
export class TravelOrder {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: 'nvarchar', length: 255 })
    employee!: string

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    employeeAddress?: string

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    collaborators?: string

    @Column({ type: 'nvarchar', length: 'max' })
    destination!: string

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    purpose?: string

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    departureLocation?: string

    @Column({ type: 'nvarchar', length: 10 })
    departureDate!: string

    @Column({ type: 'nvarchar', length: 10, nullable: true })
    departureTime?: string

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    returnLocation?: string

    @Column({ type: 'nvarchar', length: 10, nullable: true })
    returnDate?: string

    @Column({ type: 'nvarchar', length: 10, nullable: true })
    returnTime?: string

    @Column({ type: 'nvarchar', length: 10, nullable: true })
    arrivalTime?: string

    @Column({ type: 'nvarchar', length: 10, nullable: true })
    returnDepartureTime?: string

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    transportType?: string

    @Column({ type: 'nvarchar', length: 20, nullable: true })
    ecv?: string

    @Column({ type: 'float', nullable: true })
    distanceKm?: number

    @Column({ type: 'float', nullable: true })
    fuelConsumption?: number

    @Column({ type: 'float', nullable: true })
    fuelPricePerLiter?: number

    @Column({ type: 'float', nullable: true })
    advanceAmount?: number

    @Column({ type: 'float', nullable: true })
    stravneAmount?: number

    @Column({ type: 'float', nullable: true })
    stravneMultiplier?: number

    @Column({ type: 'float', nullable: true })
    actualExpenses?: number

    @Column({ type: 'nvarchar', length: 10, default: 'EUR' })
    currency!: string

    @Column({ type: 'nvarchar', length: 20, default: 'draft' })
    status!: string

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    notes?: string

    @Column({ type: 'bit', nullable: true })
    freeRanajky?: boolean | null

    @Column({ type: 'bit', nullable: true })
    freeObed?: boolean | null

    @Column({ type: 'bit', nullable: true })
    freeVecera?: boolean | null

    @Column({ type: 'bit', nullable: true })
    includeAccounting?: boolean | null

    @Column({ type: 'bit', nullable: true })
    includeAdminFields?: boolean | null

    @Column({ type: 'bit', nullable: true })
    applyAmortization?: boolean | null

    @Column({ type: 'bit', nullable: true })
    applyFuelCost?: boolean | null

    @Column({ type: 'bit', nullable: true })
    isElectric?: boolean | null

    @Column({ type: 'nvarchar', length: 20, nullable: true })
    fuelType?: string | null

    @Column({ type: 'bit', nullable: true })
    useExchangeRates?: boolean | null

    @Column({ type: 'nvarchar', length: 10, nullable: true })
    exchangeRateDate?: string | null

    @Column({
        type: 'nvarchar', length: 'max', nullable: true,
        transformer: {
            to:   (v: unknown) => (v != null ? JSON.stringify(v) : null),
            from: (v: string | null) => { try { return v ? JSON.parse(v) : null } catch { return null } },
        },
    })
    exchangeRates?: Record<string, number> | null

    @Column({
        type: 'nvarchar', length: 'max', nullable: true,
        transformer: {
            to:   (v: unknown) => (v != null ? JSON.stringify(v) : null),
            from: (v: string | null) => { try { return v ? JSON.parse(v) : null } catch { return null } },
        },
    })
    trips?: unknown[] | null

    @Column({
        type: 'nvarchar', length: 'max', nullable: true,
        transformer: {
            to:   (v: unknown) => (v != null ? JSON.stringify(v) : null),
            from: (v: string | null) => { try { return v ? JSON.parse(v) : null } catch { return null } },
        },
    })
    advances?: Array<{ amount: number; currency: string }> | null

    @Column({
        type: 'nvarchar', length: 'max', nullable: true,
        transformer: {
            to:   (v: unknown) => (v != null ? JSON.stringify(v) : null),
            from: (v: string | null) => { try { return v ? JSON.parse(v) : null } catch { return null } },
        },
    })
    ratesSnapshot?: unknown

    @Column({ type: 'float', nullable: true })
    kmRateUsed?: number | null

    @Column({ type: 'nvarchar', length: 20, nullable: true })
    ratesAlgorithmVersion?: string | null

    @Column({ type: 'int', nullable: true })
    employeeId?: number | null

    @Column({ type: 'nvarchar', length: 30 })
    createdAt!: string

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    firebaseId?: string | null

    @ManyToOne(() => Company)
    company!: Company
}
