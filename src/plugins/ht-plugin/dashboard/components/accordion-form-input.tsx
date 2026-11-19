import { DashboardFormComponent } from "@/vdb/framework/form-engine/form-engine-types.js"
import { useTranslations } from "../../../custom-attributes/dashboard/hooks/use-translations"
import { AccordionListInput } from "../../../custom-attributes/dashboard/components/accordion-list-input"

export const AccordionFormInput: DashboardFormComponent = (props) => {
    const { value, onChange, disabled } = props
    const { t } = useTranslations()

    const labels = {
        add: t("custom-attributes.common.addAccordion"),
        remove: t("custom-attributes.common.removeAccordion"),
        title: t("custom-attributes.common.accordionTitle"),
        content: t("custom-attributes.common.accordionContent"),
        empty: t("custom-attributes.common.noAccordions"),
    }

    return (
        <AccordionListInput {...props} value={value} onChange={onChange} disabled={disabled} labels={labels} />
    )
}

AccordionFormInput.metadata = { isListInput: "dynamic" }