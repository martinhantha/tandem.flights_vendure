import { VendureEntity, Translation, LanguageCode, DeepPartial } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { ProductVariantAttribute } from './entity';

@Entity()
export class ProductVariantAttributeTranslation extends VendureEntity implements Translation<ProductVariantAttribute> {
    constructor(input?: DeepPartial<Translation<ProductVariantAttribute>>) {
        super(input);
    }

    @Column('varchar') languageCode: LanguageCode;

    @Column('text') value: string;

    @Index()
    @ManyToOne((type) => ProductVariantAttribute, (base) => base.translations, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    })
    base: ProductVariantAttribute;
}
