import { VendureEntity, Translatable, DeepPartial, LocaleString, Translation, Product, ID } from '@vendure/core';
import { Column, Entity, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ProductAttributeTranslation } from './translation.entity';
import { AttributeProperty } from '../attributeProperties/entity';

@Entity()
export class ProductAttribute extends VendureEntity implements Translatable {
    constructor(input?: DeepPartial<ProductAttribute>) {
        super(input);
    }

    @Column({ nullable: true })
    productId: ID;

    @ManyToOne(() => Product, (product) => product.customFields.attributes, {})
    @JoinColumn()
    product: Product;

    @Column({ nullable: true })
    attributePropertyId: ID;

    @ManyToOne(() => AttributeProperty)
    attributeProperty: AttributeProperty;

    @Column({default: false})
    useDefault: boolean;

    value: LocaleString;

    @OneToMany((type) => ProductAttributeTranslation, (translation) => translation.base, {
        eager: true,
        cascade: true,
    })
    translations: Array<Translation<ProductAttribute>>;
}
