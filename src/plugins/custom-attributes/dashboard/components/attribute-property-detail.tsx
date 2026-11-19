import {
    DashboardRouteDefinition,
    detailPageRouteLoader,
    useDetailPage,
    Page,
    PageTitle,
    PageActionBar,
    ActionBarItem,
    Button,
    PageLayout,
    PageBlock,
    FormFieldWrapper,
    DetailFormGrid,
    Switch,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    TranslatableFormFieldWrapper, AnyRoute, useNavigate, toast } from '@vendure/dashboard';
import { useEffect, useRef } from 'react';
import { graphql } from '@/gql';
import { AccordionListInput } from './accordion-list-input';
import { useTranslations, getTranslation } from '../hooks/use-translations';

type AttributePropertyInputType = 'text' | 'textarea' | 'number' | 'json';

function normalizeAttributePropertyType(type: unknown): AttributePropertyInputType {
    const normalized = String(type ?? '')
        .trim()
        .toLowerCase()
        // handle common separators/casing variants (e.g. TextArea, text_area, text-area)
        .replace(/[\s_-]/g, '');

    switch (normalized) {
        case 'textarea':
            return 'textarea';
        case 'number':
        case 'numeric':
            return 'number';
        case 'json':
        case 'object':
            return 'json';
        case 'text':
        default:
            return 'text';
    }
}

function normalizeAttributePropertyTypeOrUndefined(type: unknown): AttributePropertyInputType | undefined {
    const raw = typeof type === 'string' ? type.trim() : String(type ?? '').trim();
    if (!raw) return undefined;
    return normalizeAttributePropertyType(raw);
}

const attributePropertyDetailDocument = graphql(`
    query GetAttributePropertyDetail($id: ID!) {
        attributeProperty(id: $id) {
            id
            createdAt
            updatedAt
            code
            type
            name
            label
            sorting
            defaultValue
            translatable
            comparable
            searchable
            filterable_in_list
            filterable_in_search
            visible_in_productdetail
            translations {
                id
                languageCode
                name
                defaultValue
            }
        }
    }
`);

const createAttributePropertyDocument = graphql(`
    mutation CreateAttributeProperty($input: CreateAttributePropertyInput!) {
        createAttributeProperty(input: $input) {
            id
        }
    }
`);

const updateAttributePropertyDocument = graphql(`
    mutation UpdateAttributeProperty($input: UpdateAttributePropertyInput!) {
        updateAttributeProperty(input: $input) {
            id
        }
    }
`);

export const attributePropertyDetail: DashboardRouteDefinition = {
    path: '/attribute-properties/$id',
    loader: detailPageRouteLoader({
        queryDocument: attributePropertyDetailDocument,
        breadcrumb: (isNew, entity) => [
            { path: '/attribute-properties', label: getTranslation('custom-attributes.attribute-properties.breadcrumb', 'Attribute Properties') },
            isNew ? getTranslation('custom-attributes.attribute-properties.newAttributeProperty', 'New attribute property') : entity?.code,
        ],
    }),
    component: route => <AttributePropertyDetailPage route={route} />,
};

function AttributePropertyDetailPage({ route }: { route: AnyRoute }) {
    const params = route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslations();
    const creatingNewEntity = params.id === 'new';
    const VButton = Button as any;
    const formRef = useRef<any>(null);

    const { form, submitHandler, entity, isPending, resetForm } = useDetailPage({
        queryDocument: attributePropertyDetailDocument,
        createDocument: createAttributePropertyDocument,
        updateDocument: updateAttributePropertyDocument,
        setValuesForUpdate: property => ({
            id: property?.id ?? '',
            code: property?.code ?? '',
            type: normalizeAttributePropertyType(property?.type),
            name: property?.name ?? '',
            label: property?.label ?? '',
            sorting: property?.sorting ?? 0,
            defaultValue: property?.defaultValue ?? '',
            translatable: typeof (property as any)?.translatable === 'boolean' ? (property as any).translatable : false,
            comparable: property?.comparable ?? true,
            searchable: property?.searchable ?? true,
            filterable_in_list: property?.filterable_in_list ?? true,
            filterable_in_search: property?.filterable_in_search ?? true,
            visible_in_productdetail: property?.visible_in_productdetail ?? true,
            translations: property?.translations ?? [],
        }),
        // Safety net: even if the generated Zod schema drops unknown keys,
        // ensure `translatable` is always present for the GraphQL Boolean! input.
        transformCreateInput: input => {
            const v = formRef.current?.getValues?.('translatable');
            const translatable =
                typeof v === 'boolean' ? v : typeof (input as any)?.translatable === 'boolean' ? (input as any).translatable : false;
            return { ...(input as any), translatable };
        },
        transformUpdateInput: input => {
            const v = formRef.current?.getValues?.('translatable');
            const translatable =
                typeof v === 'boolean' ? v : typeof (input as any)?.translatable === 'boolean' ? (input as any).translatable : false;
            return { ...(input as any), translatable };
        },
        params: { id: params.id },
        onSuccess: async data => {
            toast.success(t('custom-attributes.common.successSaved'));
            resetForm();
            if (creatingNewEntity) {
                await (navigate as any)({ to: `../$id`, params: { id: data.id } });
            }
        },
        onError: err => {
            toast.error(t('custom-attributes.common.errorSave'), {
                description: err instanceof Error ? err.message : 'Unknown error',
            });
        },
    });
    // Keep a reference so transformCreate/UpdateInput can read current form values.
    formRef.current = form;

    // Ensure the controlled Select gets a value once the entity loads.
    // (Some form wrappers don't reliably propagate async-loaded values into custom Selects.)
    useEffect(() => {
        if (creatingNewEntity) {
            // Ensure all required Boolean! inputs are explicitly set for new entities.
            // Untouched RHF switches can remain `undefined`, and JSON serialization will omit them.
            const setIfUndefined = <T,>(name: any, value: T) => {
                if (form.getValues(name) !== undefined) return;
                form.setValue(name, value as any, {
                    shouldDirty: false,
                    shouldTouch: false,
                    shouldValidate: false,
                });
            };

            form.setValue('type', form.getValues('type') || 'text', {
                shouldDirty: false,
                shouldTouch: false,
                shouldValidate: false,
            });

            setIfUndefined('translatable', false);
            setIfUndefined('comparable', true);
            setIfUndefined('searchable', true);
            setIfUndefined('filterable_in_list', true);
            setIfUndefined('filterable_in_search', true);
            setIfUndefined('visible_in_productdetail', true);
            return;
        }
        if (entity?.type) {
            form.setValue('type', normalizeAttributePropertyType(entity.type), {
                shouldDirty: false,
                shouldTouch: false,
                shouldValidate: false,
            });
        }
    }, [creatingNewEntity, entity?.type, form]);

    return (
        <Page pageId="attribute-property-detail" form={form} submitHandler={submitHandler}>
            <PageTitle>{creatingNewEntity ? t('custom-attributes.attribute-properties.newAttributeProperty') : (entity?.label ?? entity?.name ?? '')}</PageTitle>
            <PageActionBar>
                <ActionBarItem
                    itemId="save-button"
                    requiresPermission={creatingNewEntity ? ['CreateAttributeProperties'] : ['UpdateAttributeProperties']}
                >
                    <VButton
                        type="submit"
                        disabled={!form.formState.isDirty || !form.formState.isValid || isPending}
                    >
                        {creatingNewEntity ? t('custom-attributes.common.create') : t('custom-attributes.common.update')}
                    </VButton>
                </ActionBarItem>
            </PageActionBar>
            <PageLayout>
                <PageBlock column="main" blockId="main-form" title={t('custom-attributes.attribute-properties.title')}>
                    <DetailFormGrid>
                        <TranslatableFormFieldWrapper
                            control={form.control}
                            name="name"
                            label={t('custom-attributes.attribute-properties.properties.name')}
                            render={({ field }) => <Input {...(field as any)} required />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="code"
                            label={t('custom-attributes.attribute-properties.properties.code')}
                            render={({ field }) => <Input {...field} />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="label"
                            label={t('custom-attributes.attribute-properties.properties.label')}
                            render={({ field }) => <Input {...field} required />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="sorting"
                            label={t('custom-attributes.attribute-properties.properties.sorting')}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    type="number"
                                    onChange={event => field.onChange(event.target.valueAsNumber || 0)}
                                />
                            )}
                        />
                        <TranslatableFormFieldWrapper
                            control={form.control}
                            name="defaultValue"
                            label={t('custom-attributes.attribute-properties.properties.defaultValue')}
                            render={({ field }) => {
                                const selectedType =
                                    normalizeAttributePropertyTypeOrUndefined(form.watch('type')) ??
                                    normalizeAttributePropertyTypeOrUndefined(entity?.type) ??
                                    'text';
                                return selectedType === 'json' ? (
                                    <AccordionListInput
                                        value={(field as any).value}
                                        onChange={(field as any).onChange}
                                        labels={{
                                            add: t('custom-attributes.common.addAccordion'),
                                            remove: t('custom-attributes.common.removeAccordion'),
                                            title: t('custom-attributes.common.accordionTitle'),
                                            content: t('custom-attributes.common.accordionContent'),
                                            empty: t('custom-attributes.common.noAccordions'),
                                        }}
                                    />
                                ) : (
                                    <Input {...(field as any)} />
                                );
                            }}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="type"
                            label={t('custom-attributes.attribute-properties.properties.type')}
                            render={() => {
                                const selectValue =
                                    normalizeAttributePropertyTypeOrUndefined(form.watch('type')) ??
                                    normalizeAttributePropertyTypeOrUndefined(entity?.type) ??
                                    'text';

                                return (
                                <Select
                                    key={selectValue}
                                    items={{
                                        text: t('custom-attributes.attribute-properties.typeText'),
                                        textarea: t('custom-attributes.attribute-properties.typeTextarea'),
                                        number: t('custom-attributes.attribute-properties.typeNumber'),
                                        json: t('custom-attributes.attribute-properties.typeJson'),
                                    }}
                                    value={selectValue}
                                    onValueChange={value => {
                                        const normalized = normalizeAttributePropertyType(value);
                                        form.setValue('type', normalized, {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                            shouldValidate: true,
                                        });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('custom-attributes.attribute-properties.selectType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="text">{t('custom-attributes.attribute-properties.typeText')}</SelectItem>
                                        <SelectItem value="textarea">{t('custom-attributes.attribute-properties.typeTextarea')}</SelectItem>
                                        <SelectItem value="number">{t('custom-attributes.attribute-properties.typeNumber')}</SelectItem>
                                        <SelectItem value="json">{t('custom-attributes.attribute-properties.typeJson')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                );
                            }}
                        />
                    </DetailFormGrid>
                </PageBlock>
                <PageBlock column="main" blockId="settings" title={t('custom-attributes.attribute-properties.settings')}>
                    <DetailFormGrid>
                        <FormFieldWrapper
                            control={form.control}
                            name={'translatable' as any}
                            label={t('custom-attributes.attribute-properties.properties.translatable')}
                            render={({ field }) => (
                                <Switch
                                    checked={(field.value as boolean | undefined) ?? false}
                                    onCheckedChange={checked => field.onChange(checked)}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="comparable"
                            label={t('custom-attributes.attribute-properties.properties.comparable')}
                            render={({ field }) => (
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="searchable"
                            label={t('custom-attributes.attribute-properties.properties.searchable')}
                            render={({ field }) => (
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="filterable_in_list"
                            label={t('custom-attributes.attribute-properties.properties.filterable-in-list')}
                            render={({ field }) => (
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="filterable_in_search"
                            label={t('custom-attributes.attribute-properties.properties.filterable-in-search')}
                            render={({ field }) => (
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="visible_in_productdetail"
                            label={t('custom-attributes.attribute-properties.properties.visible-in-productdetail')}
                            render={({ field }) => (
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            )}
                        />
                    </DetailFormGrid>
                </PageBlock>
            </PageLayout>
        </Page>
    );
}