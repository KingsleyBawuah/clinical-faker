import { LOINC_CODING_SYSTEM } from "../codingSystems.ts";
import { ce, xcn } from "../composites.ts";
import type { HL7Order } from "../order.ts";
import { toDTM } from "../toDTM.ts";
import type { HL7Segment } from "../types.ts";
import { buildSegmentFromFields } from "./buildSegmentFromFields.ts";

/**
 * `OBR-4` (Universal Service Identifier, required). A fixed vital-signs
 * panel for now: the IR has no order concept to derive it from, and the
 * only observation codes the IR currently recognizes are vital signs (see
 * `vitalsProjection.ts`). Code and display verified against NLM's Clinical
 * Table Search Service. Tracked to become archetype-driven in Phase 4 —
 * see docs/implementation.md.
 */
const DEFAULT_UNIVERSAL_SERVICE_ID = ce(
	"85353-1",
	"Vital signs, weight, height, head circumference, oxygen saturation and BMI panel",
	LOINC_CODING_SYSTEM,
);

/** `OBR-25` (Result Status), HL7 v2 Table 0123. Only `F` (final) is generated today. */
export type ResultStatus = "F";

export interface OBRDetails {
	/** ISO-8601; `OBR-7`. */
	observationDateTime?: string;
	/** `OBR-25` — set for results (`ORU`), omitted for orders (`ORM`). */
	resultStatus?: ResultStatus;
}

/** Builds an `OBR` segment. `setId` is 1-based, per order within the message. */
export function buildOBRSegment(
	order: HL7Order,
	setId: number,
	details: OBRDetails = {},
): HL7Segment {
	const { observationDateTime, resultStatus } = details;
	return buildSegmentFromFields("OBR", {
		1: String(setId),
		2: order.placerOrderNumber,
		3: order.fillerOrderNumber,
		4: DEFAULT_UNIVERSAL_SERVICE_ID,
		...(observationDateTime === undefined
			? {}
			: { 7: toDTM(observationDateTime, "datetime") }),
		...(order.orderingProvider === undefined
			? {}
			: { 16: xcn(order.orderingProvider) }),
		...(resultStatus === undefined ? {} : { 25: resultStatus }),
	});
}
