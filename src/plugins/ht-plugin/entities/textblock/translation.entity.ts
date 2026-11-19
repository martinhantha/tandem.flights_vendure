import { VendureEntity, Translation, LanguageCode, DeepPartial } from "@vendure/core"
import { Column, Entity, Index, ManyToOne } from "typeorm"

import { Textblock } from "./entity"

@Entity()
export class TextblockTranslation extends VendureEntity implements Translation<Textblock> {
    constructor(input?: DeepPartial<Translation<Textblock>>) {
        super(input)
    }

    @Column("varchar") languageCode: LanguageCode

    @Column("text") description: string

    @Index()
    @ManyToOne((type) => Textblock, (base) => base.translations)
    base: Textblock
}
