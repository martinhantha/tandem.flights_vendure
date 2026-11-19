import gql from "graphql-tag"
import { readFileSync } from "fs"
import path from "path"

const typeDefs = gql(
    readFileSync(path.resolve("src/plugins/ht-plugin/entities/textblock/schema.gql"), {
        encoding: "utf-8",
    }) +
        readFileSync(path.resolve("src/plugins/ht-plugin/entities/order/schema-admin.gql"), {
            encoding: "utf-8",
        }) +
        readFileSync(path.resolve("src/plugins/ht-plugin/entities/bestseller/schema.gql"), {
            encoding: "utf-8",
        }) +
        readFileSync(path.resolve("src/plugins/ht-plugin/entities/customSettings/schema.gql"), {
            encoding: "utf-8",
        }) +
        readFileSync(path.resolve("src/plugins/ht-plugin/entities/voucher/schema.gql"), {
            encoding: "utf-8",
        }) +
        readFileSync(path.resolve("src/plugins/ht-plugin/entities/productVariant/schema.gql"), {
            encoding: "utf-8",
        }) +
        readFileSync(path.resolve("src/plugins/ht-plugin/entities/tools/schema-admin.gql"), {
            encoding: "utf-8",
        }),
)
export const HtSchemaAdmin = typeDefs
