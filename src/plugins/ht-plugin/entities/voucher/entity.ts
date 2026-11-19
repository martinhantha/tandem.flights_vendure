import { DeepPartial } from '@vendure/common/lib/shared-types'
import { Customer, SoftDeletable, VendureEntity } from '@vendure/core'
import { Column, Entity, ManyToOne } from 'typeorm'

@Entity()
export class Voucher extends VendureEntity implements SoftDeletable {
    constructor(input?: DeepPartial<Voucher>) {
        super(input)
    }
    @Column({ type: Date, nullable: true })
    deletedAt: Date | null

    @Column({ nullable: true })
    info: string

    @Column({ nullable: true })
    code: string

    @Column({ nullable: true })
    product_id: string

    @Column({ nullable: true })
    order_line_id: string

    @Column({ nullable: true })
    order_id: string

    @Column({ nullable: true })
    order_code: string

    @Column({ nullable: true })
    path: string

    @Column({ nullable: true })
    nth_product_item: number

    @Column({ nullable: true })
    amount: number

    @Column({ nullable: true })
    initialAmount: number

    @Column({ nullable: true })
    currencyCode: string

    @Column({ nullable: true })
    validFrom: Date

    @Column({ nullable: true })
    validTo: Date

    @ManyToOne((type) => Customer)
    customer: Customer
}
