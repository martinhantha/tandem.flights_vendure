import { VendureEntity, Translation, Translatable, SoftDeletable, LocaleString, DeepPartial } from "@vendure/core"
import { Column, Entity, OneToMany } from "typeorm"

import { TextblockTranslation } from "./translation.entity"

@Entity()
export class Textblock extends VendureEntity implements Translatable, SoftDeletable {
    constructor(input?: DeepPartial<Textblock>) {
        super(input)
    }

    @Column({ type: Date, nullable: true })
    deletedAt: Date | null

    @Column()
    name: string;

    @Column({ nullable: true })
    enabled: boolean

    description: LocaleString

    @OneToMany((type) => TextblockTranslation, (translation) => translation.base, { eager: true })
    translations: Array<Translation<Textblock>>
}
