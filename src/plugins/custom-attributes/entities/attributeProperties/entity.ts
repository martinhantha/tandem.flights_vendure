import { VendureEntity, Translatable, DeepPartial, LocaleString, Translation } from '@vendure/core';
import { Column, Entity, OneToMany, Unique } from 'typeorm';
import { AttributePropertyTranslation } from './translation.entity';

@Entity()
@Unique(['code'])
export class AttributeProperty extends VendureEntity implements Translatable {
    constructor(input?: DeepPartial<AttributeProperty>) {
        super(input);
    }

    @Column()
    code: string;

    name: LocaleString;

    defaultValue: LocaleString;

    @Column()
    type: string;

    @Column()
    label: string;

    @Column()
    sorting: number;

    @Column()
    translatable: boolean;

    @Column()
    comparable: boolean;

    @Column()
    searchable: boolean;

    @Column()
    filterable_in_list: boolean;

    @Column()
    filterable_in_search: boolean;

    @Column()
    visible_in_productdetail: boolean;

    @OneToMany((type) => AttributePropertyTranslation, (translation) => translation.base, {
        eager: true,
        cascade: true,
    })
    translations: Array<Translation<AttributeProperty>>;
}
