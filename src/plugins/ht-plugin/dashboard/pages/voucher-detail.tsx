import { 
    DashboardRouteDefinition, 
    Page, 
    PageTitle, 
    PageActionBar,
    ActionBarItem,
    Button, 
    PageLayout, 
    PageBlock, 
    FormFieldWrapper, 
    DetailFormGrid, 
    Input, 
    api,
    Textarea, useNavigate, useForm, FormProvider, toast } from "@vendure/dashboard"
import { useEffect, useState, useCallback, useRef } from "react"
import { graphql } from "@/gql"
import { getTranslation, useTranslations } from "../hooks/use-translations"

const voucherDetailDocument = graphql(`
    query GetVoucherDetail($id: ID!) {
        voucher(id: $id) {
            id
            code
            amount
            initialAmount
            createdAt
            updatedAt
            info
            customer {
                id
                firstName
                lastName
                emailAddress
            }
            validFrom
            validTo
        }
    }
`)

const createVoucherDocument = graphql(`
    mutation CreateVoucher($input: CreateVoucherInput!) {
        createVoucher(input: $input) {
            id
            code
            amount
            initialAmount
            createdAt
            updatedAt
            info
            customer {
                id
                firstName
                lastName
                emailAddress
            }
            validFrom
            validTo
        }
    }
`)

const updateVoucherDocument = graphql(`
    mutation UpdateVoucher($input: UpdateVoucherInput!) {
        updateVoucher(input: $input) {
            id
            code
            amount
            initialAmount
            createdAt
            updatedAt
            info
            customer {
                id
                firstName
                lastName
                emailAddress
            }
            validFrom
            validTo
        }
    }
`)

const searchCustomersDocument = graphql(`
    query SearchCustomers($term: String!) {
        customers(options: { 
            take: 20,
            filter: {
                _or: [
                    { emailAddress: { contains: $term } },
                    { firstName: { contains: $term } },
                    { lastName: { contains: $term } }
                ]
            },
            filterOperator: OR
        }) {
            items {
                id
                firstName
                lastName
                emailAddress
            }
        }
    }
`)

const getCustomerByIdDocument = graphql(`
    query GetCustomerById($id: ID!) {
        customer(id: $id) {
            id
            firstName
            lastName
            emailAddress
        }
    }
`)
interface VoucherFormValues {
    id: string
    code: string
    amount: number
    initialAmount: number
    customerId: string | null
    validFrom: string | null
    validTo: string | null
    info: string | null
}

export const voucherDetail: DashboardRouteDefinition = {
    path: "/vouchers/$id",
    loader: ({ params }) => ({
        breadcrumb: [
            { path: "/vouchers", label: getTranslation('voucher.title') },
            params.id === "new" ? getTranslation('voucher.newVoucher') : getTranslation('voucher.editVoucher')
        ],
    }),
    component: (route) => <VoucherDetailPage route={route} />,
}

function VoucherDetailPage({ route }: { route: any }) {
    const params = route.useParams()
    const navigate = useNavigate()
    const { t } = useTranslations()
    const isNew = params.id === "new"
    const [voucher, setVoucher] = useState<any>(null)
    const [loading, setLoading] = useState(!isNew)

    const form = useForm<VoucherFormValues>({
        defaultValues: {
            id: "",
            code: "",
            amount: 0,
            initialAmount: 0,
            customerId: null,
            validFrom: null,
            validTo: null,
            info: "",
        },
    })

    // Customer search state
    const [customerSearch, setCustomerSearch] = useState("")
    const [customerResults, setCustomerResults] = useState<{ id: string; firstName: string; lastName: string; emailAddress: string }[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; firstName: string; lastName: string; emailAddress: string } | null>(null)
    const [isSearching, setIsSearching] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Debounced customer search
    const searchCustomers = useCallback(async (term: string) => {
        if (term.length < 2) {
            setCustomerResults([])
            return
        }
        
        setIsSearching(true)
        try {
            const result = await api.query(searchCustomersDocument, { term }) as any
            if (result?.customers?.items) {
                setCustomerResults(result.customers.items)
            }
        } catch (err) {
            console.error("Failed to search customers:", err)
        } finally {
            setIsSearching(false)
        }
    }, [])

    // Handle search input change with debounce
    const handleSearchChange = useCallback((value: string) => {
        setCustomerSearch(value)
        setShowDropdown(true)
        
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }
        
        searchTimeoutRef.current = setTimeout(() => {
            searchCustomers(value)
        }, 300)
    }, [searchCustomers])

    // Handle customer selection
    const handleSelectCustomer = useCallback((customer: { id: string; firstName: string; lastName: string; emailAddress: string }) => {
        setSelectedCustomer(customer)
        setCustomerSearch("")
        setShowDropdown(false)
        form.setValue("customerId", customer.id, { shouldDirty: true })
    }, [form])

    // Clear selected customer
    const handleClearCustomer = useCallback(() => {
        setSelectedCustomer(null)
        form.setValue("customerId", null, { shouldDirty: true })
    }, [form])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Fetch voucher data on mount
    useEffect(() => {
        if (isNew) return
        
        async function fetchVoucher() {
            try {
                const result = await api.query(voucherDetailDocument, { id: params.id }) as any
                if (result?.voucher) {
                    setVoucher(result.voucher)
                    form.reset({
                        id: result.voucher.id,
                        code: result.voucher.code ?? "",
                        amount: result.voucher.amount ?? 0,
                        initialAmount: result.voucher.initialAmount ?? 0,
                        customerId: result.voucher.customer?.id ?? null,
                        validFrom: result.voucher.validFrom ?? null,
                        validTo: result.voucher.validTo ?? null,
                        info: result.voucher.info ?? null,
                    })
                    // Set selected customer if exists
                    if (result.voucher.customer) {
                        setSelectedCustomer(result.voucher.customer)
                    }
                }
            } catch (err) {
                console.error("Failed to fetch voucher:", err)
                toast.error(t("voucher.loadFailed"))
            } finally {
                setLoading(false)
            }
        }
        
        fetchVoucher()
    }, [params.id, isNew, form])

    const onSubmit = async () => {
        // Get values directly from form
        const formValues = form.getValues()
        
        try {
            if (isNew) {
                const input = {
                    code: formValues.code,
                    amount: formValues.amount,
                    initialAmount: formValues.initialAmount,
                    customerId: formValues.customerId || null,
                    validFrom: formValues.validFrom || null,
                    validTo: formValues.validTo || null,
                    info: formValues.info || null,
                }
                const result = await api.mutate(createVoucherDocument, { input }) as any
                if (result?.createVoucher) {
                    toast.success(t("voucher.createSuccess"))
                    form.reset()
                    navigate({ to: `/vouchers/${result.createVoucher.id}` })
                }
            } else {
                const input = {
                    id: formValues.id,
                    code: formValues.code,
                    amount: formValues.amount,
                    initialAmount: formValues.initialAmount,
                    customerId: formValues.customerId || null,
                    validFrom: formValues.validFrom || null,
                    validTo: formValues.validTo || null,
                    info: formValues.info || null,
                }
                const result = await api.mutate(updateVoucherDocument, { input }) as any
                if (result?.updateVoucher) {
                    const updated = result.updateVoucher
                    // Reset form with server response to clear dirty state
                    form.reset({
                        id: updated.id,
                        code: updated.code ?? "",
                        amount: updated.amount ?? 0,
                        initialAmount: updated.initialAmount ?? 0,
                        customerId: updated.customer?.id ?? null,
                        validFrom: updated.validFrom ?? null,
                        validTo: updated.validTo ?? null,
                        info: updated.info ?? null,
                    }, { keepDefaultValues: false })
                    setVoucher(updated)
                    toast.success(t("voucher.updateSuccess"))
                }
            }
        } catch (err) {
            console.error("Error saving voucher:", err)
            toast.error(t("voucher.saveFailed"), {
                description: err instanceof Error ? err.message : undefined,
            })
        }
    }

    // a voucher redeemed at the take-off place: balance to 0, so the shop and the public /qr check show it as used
    const onRedeemOnSite = async () => {
        if (!window.confirm(t("voucher.redeemOnSiteConfirm"))) return
        form.setValue("amount", 0, { shouldDirty: true })
        await onSubmit()
    }

    if (loading) {
        return <div className="p-4">{t("common.loading")}</div>
    }

    return (
        <FormProvider {...form}>
            <Page pageId="voucher-detail">
                <PageTitle>{isNew ? t("voucher.newVoucher") : (voucher?.code ?? t("voucher.title"))}</PageTitle>
                <PageActionBar>
                    {!isNew && (voucher?.amount ?? 0) > 0 && (
                        <ActionBarItem itemId="redeem-button" requiresPermission={["SuperAdmin"]}>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onRedeemOnSite}
                                disabled={form.formState.isSubmitting}
                            >
                                {t("voucher.redeemOnSite")}
                            </Button>
                        </ActionBarItem>
                    )}
                    <ActionBarItem itemId="save-button" requiresPermission={["SuperAdmin"]}>
                        <Button
                            type="button"
                            onClick={onSubmit}
                            disabled={!form.formState.isDirty || form.formState.isSubmitting}
                        >
                            {isNew ? t("voucher.create") : t("voucher.save")}
                        </Button>
                    </ActionBarItem>
                </PageActionBar>
                <PageLayout>
                <PageBlock column="main" blockId="main-form">
                    <DetailFormGrid>
                        <FormFieldWrapper 
                            control={form.control} 
                            name="code" 
                            label={t("voucher.code")} 
                            render={({ field }) => (
                                <Input {...field} placeholder={t("voucher.enterVoucherCode")} />
                            )} 
                        />
                        <FormFieldWrapper 
                            control={form.control} 
                            name="customerId" 
                            label={t("voucher.customer")} 
                            render={() => (
                                <div className="relative" ref={dropdownRef}>
                                    {selectedCustomer ? (
                                        <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-muted/50">
                                            <div>
                                                <span className="font-medium">{selectedCustomer.firstName} {selectedCustomer.lastName}</span><br />
                                                <span className="text-muted-foreground text-sm">{selectedCustomer.emailAddress}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleClearCustomer}
                                                className="text-muted-foreground hover:text-foreground ml-2"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <Input
                                                value={customerSearch}
                                                onChange={(e) => handleSearchChange(e.target.value)}
                                                onFocus={() => customerSearch.length >= 2 && setShowDropdown(true)}
                                                placeholder={t("voucher.searchCustomerPlaceholder")}
                                            />
                                            {isSearching && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                                    {t("voucher.searching")}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {showDropdown && customerResults.length > 0 && !selectedCustomer && (
                                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                                            {customerResults.map((customer) => (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                                    onClick={() => handleSelectCustomer(customer)}
                                                >
                                                    <div className="font-medium">{customer.firstName} {customer.lastName}</div>
                                                    <div className="text-sm text-muted-foreground">{customer.emailAddress}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {showDropdown && customerSearch.length >= 2 && customerResults.length === 0 && !isSearching && !selectedCustomer && (
                                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-3 text-muted-foreground text-sm">
                                            {t("voucher.noCustomersFound")}
                                        </div>
                                    )}
                                </div>
                            )} 
                        />
                        <FormFieldWrapper 
                            control={form.control} 
                            name="amount" 
                            label={t("voucher.amount")} 
                            render={({ field }) => (
                                <Input 
                                    type="number" 
                                    {...field} 
                                    onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} 
                                    placeholder={t("voucher.enterAmount")}
                                />
                            )} 
                        />
                        <FormFieldWrapper 
                            control={form.control} 
                            name="initialAmount" 
                            label={t("voucher.initialAmount")} 
                            render={({ field }) => (
                                <Input 
                                    type="number" 
                                    {...field} 
                                    onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} 
                                    placeholder={t("voucher.enterInitialAmount")}
                                />
                            )} 
                        />
                        <FormFieldWrapper 
                            control={form.control} 
                            name="validFrom" 
                            label={t("voucher.validFrom")}
                            render={({ field }) => (
                                <Input 
                                    type="date" 
                                    value={field.value ? field.value.substring(0, 10) : ""} 
                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} 
                                />
                            )} 
                        />
                        <FormFieldWrapper 
                            control={form.control} 
                            name="validTo" 
                            label={t("voucher.validTo")} 
                            render={({ field }) => (
                                <Input 
                                    type="date" 
                                    value={field.value ? field.value.substring(0, 10) : ""} 
                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} 
                                />
                            )} 
                        />
                    </DetailFormGrid>
                    <FormFieldWrapper 
                        control={form.control} 
                        name="info" 
                        label={t("voucher.info")} 
                        render={({ field }) => (
                            <Textarea {...field} placeholder={t("voucher.enterInfo")} />
                        )} 
                    />
                </PageBlock>
                {!isNew && (
                    <PageBlock column="side" blockId="meta-info">
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <p>{t("common.id")}: {voucher?.id}</p>
                            <p>{t("common.created")}: {voucher?.createdAt ? new Date(voucher.createdAt).toLocaleString() : "-"}</p>
                            <p>{t("common.updated")}: {voucher?.updatedAt ? new Date(voucher.updatedAt).toLocaleString() : "-"}</p>
                        </div>
                    </PageBlock>
                )}
                </PageLayout>
            </Page>
        </FormProvider>
    )
}
