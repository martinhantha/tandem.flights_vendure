import { SoftDeletable, VendureEntity } from "@vendure/core"
import { Entity, Column, DeepPartial } from "typeorm"

@Entity()
export class CustomSettings extends VendureEntity implements SoftDeletable {
    constructor(input?: DeepPartial<CustomSettings>) {
        super(input)
    }

    @Column({ type: Date, nullable: true })
    deletedAt: Date | null

    @Column()
    name: string

    // `longtext` is MySQL-only. `text` works on Postgres (and also MySQL).
    @Column({ type: "text" })
    value: string
}
