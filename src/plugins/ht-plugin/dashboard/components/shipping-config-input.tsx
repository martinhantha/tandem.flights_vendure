import { AffixedInput, Button, Command, CommandEmpty, CommandInput, CommandItem, CommandList, MoneyInput, Popover, PopoverContent, PopoverTrigger, api, graphql, useQuery } from "@vendure/dashboard"
import { DashboardFormComponent } from "@/vdb/framework/form-engine/form-engine-types.js"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { CountryEntry, EMPTY_COUNTRY_ENTRY, ShippingConfig, parseShippingConfig, toInt, toNumber } from "../../shipping/shipping-config"
import { useTranslations } from "../hooks/use-translations"

const countryListDocument = graphql(`
    query ShippingConfigCountryList {
        countries(options: { sort: { name: ASC }, filter: { enabled: { eq: true } } }) {
            items {
                id
                code
                name
            }
        }
    }
`)

type CountryOption = { id: string; code: string; name: string }

function CountryCombobox(props: { value: string; onChange: (code: string) => void; countries: CountryOption[]; placeholder: string; searchPlaceholder: string; emptyText: string; disabled?: boolean }) {
    const { value, onChange, countries, placeholder, searchPlaceholder, emptyText, disabled } = props
    const [open, setOpen] = useState(false)
    const VButton = Button as any
    const selected = countries.find((c) => c.code === value)
    const triggerLabel = selected ? `${selected.name} (${selected.code})` : value ? value : placeholder

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger render={<VButton type="button" variant="outline" role="combobox" disabled={disabled} className="w-full justify-between font-normal" />}>
                <span className={selected || value ? "" : "text-muted-foreground"}>{triggerLabel}</span>
                <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[280px]" align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        {countries.map((c) => (
                            <CommandItem
                                key={c.code}
                                value={`${c.name} ${c.code}`}
                                onSelect={() => {
                                    onChange(c.code)
                                    setOpen(false)
                                }}
                            >
                                <CheckIcon className={"mr-2 h-4 w-4 " + (value === c.code ? "opacity-100" : "opacity-0")} />
                                <span>{c.name}</span>
                                <span className="ml-2 text-muted-foreground text-xs">{c.code}</span>
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export const ShippingConfigInput: DashboardFormComponent = (props) => {
    const { value, onChange, disabled } = props
    const VButton = Button as any
    const { t } = useTranslations()
    const config = useMemo(() => parseShippingConfig(value), [value])
    const rootRef = useRef<HTMLDivElement>(null)

    const { data: countriesData } = useQuery({
        queryKey: ["shipping-config-countries"],
        queryFn: () => api.query(countryListDocument, {}),
        staleTime: 1000 * 60 * 60,
    })
    const countries = countriesData?.countries.items ?? []

    useEffect(() => {
        const el = rootRef.current
        if (!el) return
        // Find the FormItem ancestor (direct child of the args grid) and make it span full width.
        let parent: HTMLElement | null = el.parentElement
        while (parent && !parent.parentElement?.classList.contains("grid")) {
            parent = parent.parentElement
        }
        parent?.classList.add("sm:col-span-2")
    }, [])

    const update = (next: ShippingConfig) => {
        onChange(JSON.stringify(next))
    }

    const updateDefault = (patch: Partial<ShippingConfig>) => {
        update({ ...config, ...patch })
    }

    const updateCountry = (index: number, patch: Partial<CountryEntry>) => {
        update({
            ...config,
            countries: config.countries.map((c, i) => (i === index ? { ...c, ...patch } : c)),
        })
    }

    const addCountry = () => {
        update({ ...config, countries: [...config.countries, { ...EMPTY_COUNTRY_ENTRY }] })
    }

    const removeCountry = (index: number) => {
        update({ ...config, countries: config.countries.filter((_, i) => i !== index) })
    }

    return (
        <div ref={rootRef} className="space-y-3">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_2.25rem] items-end gap-2 text-sm font-medium">
                <div>{t("shipping.country")}</div>
                <div>{t("shipping.rate")}</div>
                <div>{t("shipping.freeShipping")}</div>
                <div>{t("shipping.taxRate")}</div>
                <div />
            </div>

            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_2.25rem] items-center gap-2">
                <div className="text-sm font-medium">{t("shipping.default")}</div>
                <MoneyInput value={config.defaultRate} onChange={(cents: number) => updateDefault({ defaultRate: toInt(cents) })} disabled={disabled} />
                <MoneyInput value={config.defaultFreeShipping} onChange={(cents: number) => updateDefault({ defaultFreeShipping: toInt(cents) })} disabled={disabled} />
                <AffixedInput type="number" min={0} step={0.1} value={config.defaultTaxRate} onChange={(e) => updateDefault({ defaultTaxRate: toNumber(e.target.value) })} disabled={disabled} suffix="%" />
                <div />
            </div>

            {config.countries.map((country, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_2.25rem] items-center gap-2">
                    <CountryCombobox value={country.code} onChange={(code) => updateCountry(index, { code })} countries={countries} placeholder={t("shipping.countryPlaceholder")} searchPlaceholder={t("common.searchCountriesPlaceholder")} emptyText={t("shipping.noCountriesFound")} disabled={disabled} />
                    <MoneyInput value={country.rate} onChange={(cents: number) => updateCountry(index, { rate: toInt(cents) })} disabled={disabled} />
                    <MoneyInput value={country.freeShipping} onChange={(cents: number) => updateCountry(index, { freeShipping: toInt(cents) })} disabled={disabled} />
                    <AffixedInput type="number" min={0} step={0.1} value={country.taxRate} onChange={(e) => updateCountry(index, { taxRate: toNumber(e.target.value) })} disabled={disabled} suffix="%" />
                    <VButton type="button" variant="outline" size="sm" disabled={disabled} onClick={() => removeCountry(index)}>
                        <Trash2Icon className="h-4 w-4" />
                    </VButton>
                </div>
            ))}

            <VButton type="button" variant="outline" onClick={addCountry} disabled={disabled}>
                <PlusIcon className="mr-2 h-4 w-4" />
                {t("shipping.addCountry")}
            </VButton>
        </div>
    )
}

ShippingConfigInput.metadata = { isListInput: "dynamic" }
