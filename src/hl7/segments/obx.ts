import type { ObservationEntity } from "../../entities/types.ts";
import { LOINC_CODING_SYSTEM, UCUM_CODING_SYSTEM } from "../codingSystems.ts";
import { ce } from "../composites.ts";
import { toHL7ValueType } from "../mappings/valueType.ts";
import { toDTM } from "../toDTM.ts";
import type { HL7Segment } from "../types.ts";
import { buildSegmentFromFields } from "./buildSegmentFromFields.ts";

/** `OBX-11` (required), HL7 v2 Table 0085: `F` — final results. */
const FINAL_RESULT_STATUS = "F";

/**
 * Builds an `OBX` segment from an `ObservationEntity`. `setId` is 1-based
 * and resets per `ORDER_OBSERVATION` group, not per message. `OBX-7` uses
 * the spec's own `lower limit-upper limit` format for numeric ranges.
 * `OBX-11` is always `F`: the IR has no result-lifecycle concept, and every
 * generated observation is a completed measurement.
 */
export function buildOBXSegment(
	observation: ObservationEntity,
	setId: number,
): HL7Segment {
	const { unit, referenceRange, abnormalFlag } = observation;
	return buildSegmentFromFields("OBX", {
		1: String(setId),
		2: toHL7ValueType(observation.value),
		3: ce(observation.loincCode, observation.display, LOINC_CODING_SYSTEM),
		5: String(observation.value),
		...(unit === undefined ? {} : { 6: ce(unit, unit, UCUM_CODING_SYSTEM) }),
		...(referenceRange === undefined
			? {}
			: { 7: `${referenceRange.low}-${referenceRange.high}` }),
		...(abnormalFlag === undefined ? {} : { 8: abnormalFlag }),
		11: FINAL_RESULT_STATUS,
		14: toDTM(observation.effectiveDateTime, "datetime"),
	});
}
