import { VendureEntity, Translation, LanguageCode, DeepPartial } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { FacetAttribute } from './entity';

@Entity()
export class FacetAttributeTranslation extends VendureEntity implements Translation<FacetAttribute> {
    constructor(input?: DeepPartial<Translation<FacetAttribute>>) {
        super(input);
    }

    @Column('varchar') languageCode: LanguageCode;

    @Column('text') value: string;

    @Index()
    @ManyToOne((type) => FacetAttribute, (base) => base.translations, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    })
    base: FacetAttribute;
}
