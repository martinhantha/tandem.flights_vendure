import { Order, RequestContext, VendureEvent } from "@vendure/core"

export class SendShippingEvent extends VendureEvent {
    constructor(public ctx: RequestContext, public order: Order) {
        super()
    }
}
