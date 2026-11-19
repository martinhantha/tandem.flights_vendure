import { VendureEntity, Translation, LanguageCode, DeepPartial } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { AttributeProperty } from './entity';

@Entity()
export class AttributePropertyTranslation extends VendureEntity implements Translation<AttributeProperty> {
    constructor(input?: DeepPartial<Translation<AttributeProperty>>) {
        super(input);
    }

    @Column('varchar') languageCode: LanguageCode;

    @Column('text') name: string;

    @Column('text') defaultValue: string;

    @Index()
    @ManyToOne((type) => AttributeProperty, (base) => base.translations, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    })
    base: AttributeProperty;
}
