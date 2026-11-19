import { VendureEntity, Translatable, DeepPartial, LocaleString, Translation, Facet, ID } from "@vendure/core"
import { Column, Entity, OneToMany, ManyToOne } from "typeorm"
import { FacetAttributeTranslation } from "./translation.entity"
import { AttributeProperty } from "../attributeProperties/entity"

@Entity()
export class FacetAttribute extends VendureEntity implements Translatable {
    constructor(input?: DeepPartial<FacetAttribute>) {
        super(input)
    }

    @Column({ nullable: true })
    facetId: ID

    @ManyToOne(() => Facet)
    facet: Facet

    @Column({ nullable: true })
    attributePropertyId: ID

    @ManyToOne(() => AttributeProperty)
    attributeProperty: AttributeProperty

    value: LocaleString

    @OneToMany((type) => FacetAttributeTranslation, (translation) => translation.base, {
        eager: true,
        cascade: true,
    })
    translations: Array<Translation<FacetAttribute>>
}
