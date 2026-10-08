import { xcn } from "../composites.ts";
import type { HL7Order } from "../order.ts";
import type { HL7Segment } from "../types.ts";
import { buildSegmentFromFields } from "./buildSegmentFromFields.ts";

/**
 * `ORC-1` (required), HL7 v2 Table 0119: `RE` (observations to follow) for
 * `ORU^R01`, `NW` (new order) for `ORM^O01`.
 */
export type OrderControl = "RE" | "NW";

/** Builds an `ORC` segment. */
export function buildORCSegment(
	order: HL7Order,
	orderControl: OrderControl,
): HL7Segment {
	return buildSegmentFromFields("ORC", {
		1: orderControl,
		2: order.placerOrderNumber,
		3: order.fillerOrderNumber,
		...(order.orderingProvider === undefined
			? {}
			: { 12: xcn(order.orderingProvider) }),
	});
}
