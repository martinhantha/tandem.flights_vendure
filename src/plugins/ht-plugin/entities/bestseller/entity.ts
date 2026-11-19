import { VendureEntity, DeepPartial, ProductVariant } from "@vendure/core"
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm"

@Entity()
export class Bestseller extends VendureEntity {
    constructor(input?: DeepPartial<Bestseller>) {
        super(input)
    }

    
    @ManyToOne(() => ProductVariant)
    @JoinColumn()
    productVariant: ProductVariant

    @Column({ nullable: true })
    productVariantId: string

    @Column({ nullable: true })
    totalSales: number

    @Column({ nullable: true })
    date: Date

    @Column({ nullable: true })
    price: number

    @Column("simple-array", { nullable: true })
    orderlineIds: string[]
}
