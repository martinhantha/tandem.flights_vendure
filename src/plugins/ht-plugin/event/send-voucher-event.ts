import { Order, RequestContext, VendureEvent } from '@vendure/core'

export class SendVoucherEvent extends VendureEvent {
	constructor(public ctx: RequestContext, public order: Order) {
		super()
	}
}
