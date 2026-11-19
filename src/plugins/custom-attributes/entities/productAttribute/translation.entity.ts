import { VendureEntity, Translation, LanguageCode, DeepPartial } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { ProductAttribute } from './entity';

@Entity()
export class ProductAttributeTranslation extends VendureEntity implements Translation<ProductAttribute> {
    constructor(input?: DeepPartial<Translation<ProductAttribute>>) {
        super(input);
    }

    @Column('varchar') languageCode: LanguageCode;

    @Column('text') value: string;

    @Index()
    @ManyToOne((type) => ProductAttribute, (base) => base.translations, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    })
    base: ProductAttribute;
}
