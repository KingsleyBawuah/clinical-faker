import type { ObservationEntity } from "../../entities/types.ts";
import type { HL7Order } from "../order.ts";
import { buildOBXSegment } from "../segments/obx.ts";
import type { HL7Segment } from "../types.ts";
import { buildCommonOrderSegments } from "./commonOrder.ts";

/** Earliest `effectiveDateTime`, or `undefined` for an empty list. */
function earliestEffectiveDateTime(
	observations: readonly ObservationEntity[],
): string | undefined {
	let earliest: ObservationEntity | undefined;
	for (const observation of observations) {
		if (
			earliest === undefined ||
			Date.parse(observation.effectiveDateTime) <
				Date.parse(earliest.effectiveDateTime)
		) {
			earliest = observation;
		}
	}
	return earliest?.effectiveDateTime;
}

/**
 * Builds one `ORU^R01` `ORDER_OBSERVATION` group: `ORC, OBR, {OBX}`. `OBX`
 * Set IDs restart at 1 within each group. Zero observations is a valid
 * group (`ORC` + `OBR`, no `OBX`) — see docs/architecture.md's
 * "Empty-collection handling for `ORU^R01`". `OBR-7` is the earliest
 * observation's time, when there is one.
 */
export function buildOrderObservationGroup(
	order: HL7Order,
	setId: number,
	observations: readonly ObservationEntity[],
): HL7Segment[] {
	const observationDateTime = earliestEffectiveDateTime(observations);
	return [
		...buildCommonOrderSegments(order, "RE", setId, {
			...(observationDateTime === undefined ? {} : { observationDateTime }),
			resultStatus: "F",
		}),
		...observations.map((observation, i) =>
			buildOBXSegment(observation, i + 1),
		),
	];
}
