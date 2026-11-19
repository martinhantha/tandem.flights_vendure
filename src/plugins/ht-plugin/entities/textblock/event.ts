import { RequestContext, VendureEntityEvent, ID } from "@vendure/core"

import { CreateTextblockInput, UpdateTextblockInput } from "src/gql/generated"
import { Textblock } from "./entity"

type TextblockInputTypes = CreateTextblockInput | UpdateTextblockInput | ID

/**
 * @description
 * This event is fired whenever a {@link Textblock} is added, updated
 * or deleted.
 *
 * @docsCategory events
 * @docsPage Event Types
 */
export class TextblockEvent extends VendureEntityEvent<Textblock, TextblockInputTypes> {
    constructor(ctx: RequestContext, entity: Textblock, type: "created" | "updated" | "deleted", input?: TextblockInputTypes) {
        super(entity, type, ctx, input)
    }

    /**
     * Return an textblock field to become compatible with the
     * deprecated old version of TextblockEvent
     * @deprecated Use `entity` instead
     * @since 1.4
     */
    get textblock(): Textblock {
        return this.entity
    }
}
