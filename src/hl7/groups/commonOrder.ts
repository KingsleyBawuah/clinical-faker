import type { HL7Order } from "../order.ts";
import { buildOBRSegment, type OBRDetails } from "../segments/obr.ts";
import { buildORCSegment, type OrderControl } from "../segments/orc.ts";
import type { HL7Segment } from "../types.ts";

/**
 * Builds the `ORC, OBR` pair shared by `ORU^R01`'s `ORDER_OBSERVATION`
 * group and `ORM^O01`'s `ORDER` group. Both segments carry the same
 * placer/filler order numbers, so they always describe one order.
 */
export function buildCommonOrderSegments(
	order: HL7Order,
	orderControl: OrderControl,
	setId: number,
	details: OBRDetails = {},
): HL7Segment[] {
	return [
		buildORCSegment(order, orderControl),
		buildOBRSegment(order, setId, details),
	];
}
