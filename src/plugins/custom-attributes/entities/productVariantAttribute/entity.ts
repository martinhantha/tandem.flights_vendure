import { VendureEntity, Translatable, DeepPartial, LocaleString, Translation, ProductVariant, ID } from '@vendure/core';
import { Column, Entity, OneToMany, ManyToOne, ManyToMany } from 'typeorm';
import { ProductVariantAttributeTranslation } from './translation.entity';
import { AttributeProperty } from '../attributeProperties/entity';

@Entity()
export class ProductVariantAttribute extends VendureEntity implements Translatable {
    constructor(input?: DeepPartial<ProductVariantAttribute>) {
        super(input);
    }

    @Column({ nullable: true })
    productVariantId: ID;

    @ManyToOne(() => ProductVariant)
    productVariant: ProductVariant;
    
    @Column({ nullable: true })
    attributePropertyId: ID;
    
    @ManyToOne(() => AttributeProperty)
    attributeProperty: AttributeProperty;

    value: LocaleString;

    @OneToMany((type) => ProductVariantAttributeTranslation, (translation) => translation.base, {
        eager: true,
        cascade: true,
    })
    translations: Array<Translation<ProductVariantAttribute>>;
}
