import gql from "graphql-tag"
import { readFileSync } from "fs"
import path from "path"

const typeDefs = gql(
    readFileSync(path.resolve("src/plugins/ht-plugin/entities/textblock/schema.gql"), {
        encoding: "utf-8",
    }) +
        readFileSync(path.resolve("src/plugins/ht-plugin/search/schema.gql"), {
            encoding: "utf-8",
        }) +
        readFileSync(path.resolve("src/plugins/ht-plugin/entities/collection/schema.gql"), {
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
        readFileSync(path.resolve("src/plugins/ht-plugin/entities/order/schema.gql"), {
            encoding: "utf-8",
        }) +
        readFileSync(path.resolve("src/plugins/ht-plugin/shipping/schema.gql"), {
            encoding: "utf-8",
        }) +
        readFileSync(path.resolve("src/plugins/ht-plugin/entities/customer/shop-customer-sepa.schema.gql"), {
            encoding: "utf-8",
        })
)
export const HtSchema = typeDefs
