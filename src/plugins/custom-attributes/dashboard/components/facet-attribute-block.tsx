import {
    Button,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
    Form,
    FormFieldWrapper,
    api,
    TranslatableFormFieldWrapper, useQuery, useMutation, useQueryClient, useForm, toast } from '@vendure/dashboard';
import { PlusIcon, Trash2Icon, EditIcon } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { graphql } from '@/gql';
import { AccordionListInput } from './accordion-list-input';
import { useTranslations } from '../hooks/use-translations';

const getFacetAttributesDocument = graphql(`
    query GetFacetAttributes($options: FacetAttributeListOptions) {
        facetAttributes(options: $options) {
            items {
                id
                value
                translations {
                    id
                    languageCode
                    value
                }
                facetId
                attributePropertyId
                attributeProperty {
                    code
                }
            }
            totalItems
        }
    }
`);

const getAttributePropertiesDocument = graphql(`
    query GetAttributePropertiesForFacetSelect {
        attributeProperties {
            items {
                id
                code
                name
                label
                type
                translatable
            }
        }
    }
`);

const getGlobalSettingsDocument = graphql(`
    query GetGlobalSettingsForFacetAttributeLanguages {
        globalSettings {
            availableLanguages
        }
    }
`);

const createFacetAttributeDocument = graphql(`
    mutation CreateFacetAttribute($input: CreateFacetAttributeInput!) {
        createFacetAttribute(input: $input) {
            id
        }
    }
`);

const updateFacetAttributeDocument = graphql(`
    mutation UpdateFacetAttribute($input: UpdateFacetAttributeInput!) {
        updateFacetAttribute(input: $input) {
            id
        }
    }
`);

const deleteFacetAttributeDocument = graphql(`
    mutation DeleteFacetAttribute($input: DeleteFacetAttributeInput!) {
        deleteFacetAttribute(input: $input) {
            result
            message
        }
    }
`);

export function FacetAttributeBlock({ context }: { context: any }) {
    const facetId = context.entity?.id;
    const queryClient = useQueryClient();
    const { t, locale } = useTranslations();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAttribute, setEditingAttribute] = useState<any>(null);
    const VButton = Button as any;

    const { data: globalSettingsData } = useQuery({
        queryKey: ['global-settings'],
        queryFn: () => api.query(getGlobalSettingsDocument),
    });

    const { data: attributesData, isLoading } = useQuery({
        queryKey: ['facet-attributes', facetId],
        queryFn: () =>
            api.query(getFacetAttributesDocument, {
                options: { filter: { facetId: { eq: facetId } } },
            }),
        enabled: !!facetId,
    });

    const { data: propertiesData } = useQuery({
        queryKey: ['attribute-properties-facet'],
        queryFn: () => api.query(getAttributePropertiesDocument),
    });

    const attributes = attributesData?.facetAttributes?.items ?? [];
    const properties = propertiesData?.attributeProperties?.items ?? [];
    const usedPropertyIds = new Set(attributes.map(a => a.attributePropertyId ?? ''));
    const selectableProperties = properties.filter(prop => Boolean(prop.id));
    const propertyNameByCode = useMemo(() => {
        return new Map((properties ?? []).map(p => [p.code, p.label] as const));
    }, [properties]);

    const availableLanguages =
        (globalSettingsData as any)?.globalSettings?.availableLanguages?.filter(Boolean) ??
        // sensible fallback so the form always has at least one translation row
        ['en'];

    // Ensure the form always has a translation row for the dashboard display language,
    // even if global settings are still loading or the attribute currently has no translation.
    const languageCodes = useMemo(() => {
        const codes = [...availableLanguages, locale].filter(Boolean).map(String);
        return Array.from(new Set(codes));
    }, [availableLanguages, locale]);

    const defaultLanguageCode = languageCodes[0] ?? locale ?? 'en';

    function normalizeTranslations(
        translations: Array<{ id?: string | null; languageCode?: string | null; value?: string | null }> | undefined,
        fallbackValue: string,
    ) {
        const input = Array.isArray(translations) ? translations : [];
        return languageCodes.map((languageCode: string) => {
            const existing = input.find(t => t?.languageCode === languageCode);
            return {
                id: existing?.id ?? undefined,
                languageCode,
                value: (existing?.value ?? fallbackValue) ?? '',
            };
        });
    }

    const form = useForm({
        defaultValues: {
            attributePropertyId: '',
            value: '',
            translations: [{ languageCode: defaultLanguageCode, value: '' }],
        },
        mode: 'onChange',
    });

    const selectedProperty = properties.find(p => p.id === form.watch('attributePropertyId'));
    const selectedInputType = selectedProperty?.type === 'number' ? 'number' : 'text';
    const isTranslatable = !!(selectedProperty as any)?.translatable;
    const isJsonType = selectedProperty?.type === 'json';
    const accordionLabels = {
        add: t('custom-attributes.common.addAccordion'),
        remove: t('custom-attributes.common.removeAccordion'),
        title: t('custom-attributes.common.accordionTitle'),
        content: t('custom-attributes.common.accordionContent'),
        empty: t('custom-attributes.common.noAccordions'),
    };

    // If a translatable property is selected (especially on "create" where translations start empty),
    // make sure we have translation rows for all dashboard languages.
    useEffect(() => {
        if (!isDialogOpen || !isTranslatable) return;
        const currentTranslations = form.getValues('translations') as any[] | undefined;
        const currentCodes = (Array.isArray(currentTranslations) ? currentTranslations : [])
            .map(t => t?.languageCode)
            .filter(Boolean)
            .map(String);

        const normalized = normalizeTranslations(currentTranslations as any, String(form.getValues('value') ?? ''));
        const normalizedCodes = normalized.map(t => String(t.languageCode));
        const hasAllCodes = normalizedCodes.every(code => currentCodes.includes(code));

        if (!hasAllCodes || (currentTranslations?.length ?? 0) !== normalized.length) {
            form.setValue('translations', normalized as any, {
                shouldDirty: false,
                shouldTouch: false,
                shouldValidate: false,
            });
        }
    }, [form, isDialogOpen, isTranslatable, languageCodes]);

    const createMutation = useMutation({
        mutationFn: (input: any) => api.mutate(createFacetAttributeDocument, { input }),
        onSuccess: () => {
            toast.success(t('custom-attributes.common.successCreated'));
            queryClient.invalidateQueries({ queryKey: ['facet-attributes', facetId] });
            setIsDialogOpen(false);
            form.reset();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const updateMutation = useMutation({
        mutationFn: (input: any) => api.mutate(updateFacetAttributeDocument, { input }),
        onSuccess: () => {
            toast.success(t('custom-attributes.common.successUpdated'));
            queryClient.invalidateQueries({ queryKey: ['facet-attributes', facetId] });
            setIsDialogOpen(false);
            setEditingAttribute(null);
            form.reset();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deleteMutation = useMutation({
        mutationFn: (input: any) => api.mutate(deleteFacetAttributeDocument, { input }),
        onSuccess: () => {
            toast.success(t('custom-attributes.common.successDeleted'));
            queryClient.invalidateQueries({ queryKey: ['facet-attributes', facetId] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const onSubmit = (data: any) => {
        if (!data.attributePropertyId) {
            toast.error(t('custom-attributes.common.errorSelectAttribute'));
            return;
        }
        const propertyForSubmit = properties.find(p => p.id === data.attributePropertyId);
        const shouldUseTranslations = !!(propertyForSubmit as any)?.translatable;
        const normalized = normalizeTranslations(data.translations, data.value ?? '');
        // For "non-translatable" properties, store the SAME value for all languages so `value: String!`
        // can be resolved regardless of the current ctx.languageCode.
        const translations = shouldUseTranslations
            ? normalized
            : normalized.map(t => ({ ...t, value: data.value ?? '' }));

        if (editingAttribute) {
            updateMutation.mutate({
                id: editingAttribute.id,
                facetId,
                attributePropertyId: data.attributePropertyId,
                translations,
            });
        } else {
            createMutation.mutate({
                facetId,
                attributePropertyId: data.attributePropertyId,
                translations,
            });
        }
    };

    // the block is rendered inside the form of the detail page, the submit must not bubble up to it,
    // otherwise the entity (e.g. the product variant) is saved as well
    const onDialogSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.stopPropagation();
        return form.handleSubmit(onSubmit)(event);
    };

    const openEditDialog = (attribute: any) => {
        setEditingAttribute(attribute);
        const fallbackValue =
            attribute?.value ??
            attribute?.translations?.find((tr: any) => tr?.languageCode === locale)?.value ??
            attribute?.translations?.[0]?.value ??
            '';
        form.reset({
            attributePropertyId: attribute.attributePropertyId ?? '',
            value: fallbackValue,
            translations: normalizeTranslations(attribute.translations, fallbackValue),
        });
        setIsDialogOpen(true);
    };

    const openCreateDialog = () => {
        setEditingAttribute(null);
        form.reset({
            attributePropertyId: '',
            value: '',
            translations: normalizeTranslations([], ''),
        });
        setIsDialogOpen(true);
    };

    if (!facetId) return null;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger render={<VButton variant="outline" size="sm" onClick={openCreateDialog} />}>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        {t('custom-attributes.common.addAttribute')}
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingAttribute ? t('custom-attributes.common.editAttribute') : t('custom-attributes.common.addAttribute')}
                            </DialogTitle>
                        </DialogHeader>
                        {/* own form context, otherwise the fields resolve the translations of the detail page form */}
                        <Form {...form}>
                            <form onSubmit={onDialogSubmit} className="space-y-4">
                                <FormFieldWrapper
                                    control={form.control}
                                    name="attributePropertyId"
                                    label={`${t('custom-attributes.common.attribute')} *`}
                                    rules={{ required: t('custom-attributes.common.errorSelectAttribute') }}
                                    render={({ field }) => (
                                        <Select
                                            items={Object.fromEntries(selectableProperties.map(prop => [prop.id, prop.label]))}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            disabled={!!editingAttribute}
                                            required
                                        >
                                            <SelectTrigger className={!field.value && !editingAttribute ? 'border-destructive' : ''}>
                                                <SelectValue placeholder={t('custom-attributes.common.selectAttribute')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectableProperties.map(prop => (
                                                    <SelectItem
                                                        key={prop.id}
                                                        value={prop.id}
                                                        disabled={!editingAttribute && usedPropertyIds.has(prop.id)}
                                                    >
                                                        {prop.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {isTranslatable ? (
                                    <TranslatableFormFieldWrapper
                                        control={form.control}
                                        name="value"
                                        label={t('custom-attributes.facet-attribute.properties.value')}
                                        render={({ field }) =>
                                            isJsonType ? (
                                                <AccordionListInput
                                                    value={(field as any).value}
                                                    onChange={(field as any).onChange}
                                                    disabled={!form.watch('attributePropertyId')}
                                                    labels={accordionLabels}
                                                />
                                            ) : selectedProperty?.type === 'textarea' ? (
                                                <Textarea {...(field as any)} rows={5} disabled={!form.watch('attributePropertyId')} />
                                            ) : (
                                                <Input
                                                    {...(field as any)}
                                                    type={selectedInputType}
                                                    inputMode={selectedInputType === 'number' ? 'decimal' : undefined}
                                                    step={selectedInputType === 'number' ? 'any' : undefined}
                                                    disabled={!form.watch('attributePropertyId')}
                                                />
                                            )
                                        }
                                    />
                                ) : (
                                    <FormFieldWrapper
                                        control={form.control}
                                        name="value"
                                        label={t('custom-attributes.facet-attribute.properties.value')}
                                        render={({ field }) =>
                                            isJsonType ? (
                                                <AccordionListInput
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    disabled={!form.watch('attributePropertyId')}
                                                    labels={accordionLabels}
                                                />
                                            ) : selectedProperty?.type === 'textarea' ? (
                                                <Textarea {...field} rows={5} disabled={!form.watch('attributePropertyId')} />
                                            ) : (
                                                <Input
                                                    {...field}
                                                    type={selectedInputType}
                                                    inputMode={selectedInputType === 'number' ? 'decimal' : undefined}
                                                    step={selectedInputType === 'number' ? 'any' : undefined}
                                                    disabled={!form.watch('attributePropertyId')}
                                                />
                                            )
                                        }
                                    />
                                )}
                                <div className="flex justify-end gap-2">
                                    <VButton
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsDialogOpen(false)}
                                    >
                                        {t('custom-attributes.common.cancel')}
                                    </VButton>
                                    <VButton 
                                        type="submit"
                                        disabled={!form.watch('attributePropertyId') && !editingAttribute}
                                    >
                                        {editingAttribute ? t('custom-attributes.common.update') : t('custom-attributes.common.create')}
                                    </VButton>
                                </div>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="text-muted-foreground">{t('custom-attributes.common.loading')}</div>
            ) : attributes.length === 0 ? (
                <div className="text-muted-foreground text-sm">{t('custom-attributes.common.noAttributesDefined')}</div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('custom-attributes.facet-attribute.properties.code')}</TableHead>
                            <TableHead>{t('custom-attributes.facet-attribute.properties.value')}</TableHead>
                            <TableHead className="w-[100px]">{t('custom-attributes.common.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {attributes.map(attr => (
                            <TableRow key={attr.id}>
                                <TableCell className="font-medium">{propertyNameByCode.get(attr.attributeProperty?.code ?? '') ?? attr.attributeProperty?.code}</TableCell>
                                <TableCell className="truncate max-w-[200px]">
                                    {attr.value ?? attr.translations?.find((tr: any) => tr?.languageCode === locale)?.value ?? attr.translations?.[0]?.value ?? ''}
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-1">
                                        <VButton
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditDialog(attr)}
                                        >
                                            <EditIcon className="h-4 w-4" />
                                        </VButton>
                                        <VButton
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                if (confirm(t('custom-attributes.common.deleteConfirm'))) {
                                                    deleteMutation.mutate({
                                                        id: attr.id,
                                                    });
                                                }
                                            }}
                                        >
                                            <Trash2Icon className="h-4 w-4 text-destructive" />
                                        </VButton>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}