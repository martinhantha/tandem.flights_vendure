import { useEffect } from "react"
import { DefaultRelationInput } from "@/vdb/components/data-input/default-relation-input.js"
import { DashboardFormComponent } from "@/vdb/framework/form-engine/form-engine-types.js"
import { useFormContext, useWatch } from "@vendure/dashboard"

export const RelatedProductsFormInput: DashboardFormComponent = (props) => {
    const { unregister, setValue } = useFormContext()
    const relatedProducts = useWatch({ name: "customFields.relatedProducts" })

    useEffect(() => {
        if (relatedProducts !== undefined) {
            // Ensure the non-id relation array never makes it into the payload.
            unregister("customFields.relatedProducts")
            setValue("customFields.relatedProducts", undefined, {
                shouldDirty: false,
                shouldValidate: false,
            })
        }
    }, [relatedProducts, setValue, unregister])

    return <DefaultRelationInput {...props} entityType="Product" />
}

RelatedProductsFormInput.metadata = { isListInput: "dynamic" }
