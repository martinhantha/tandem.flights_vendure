import gql from "graphql-tag"
import { readFileSync } from "fs"
import path from "path"

const typeDefs = gql(
    readFileSync(path.resolve("src/plugins/custom-attributes/entities/productAttribute/schema.gql"), {
        encoding: "utf-8",
    }) +
        readFileSync(path.resolve("src/plugins/custom-attributes/entities/productVariantAttribute/schema.gql"), {
            encoding: "utf-8",
        }) +
        readFileSync(path.resolve("src/plugins/custom-attributes/entities/facetAttribute/schema.gql"), {
            encoding: "utf-8",
        }) +
        readFileSync(path.resolve("src/plugins/custom-attributes/entities/attributeProperties/schema.gql"), {
            encoding: "utf-8",
        })
)
export const CustomAttributesSchema = typeDefs
