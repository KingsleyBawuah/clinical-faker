import type { PRNG } from "../../core/prng/types.ts";
import type { PatientGraph } from "../../entities/types.ts";
import { msg } from "../composites.ts";
import type { HL7ExportOptions } from "../exportOptions.ts";
import { buildOrderObservationGroup } from "../groups/orderObservation.ts";
import { buildHL7Order } from "../order.ts";
import { buildPIDSegment } from "../segments/pid.ts";
import { buildPV1Segment } from "../segments/pv1.ts";
import type { HL7Message } from "../types.ts";
import { buildMessageHeader, messageDateTime } from "./header.ts";

/** `ORU^R01`'s abstract message structure, confirmed against `hl7v2-dictionary`'s HL7 v2.5.1 message definitions. */
const ORU_MESSAGE_STRUCTURE = "ORU_R01";

/**
 * Builds an `ORU^R01` message: `MSH, PATIENT_RESULT{ PATIENT{ PID, [PV1] },
 * ORDER_OBSERVATION{ ORC, OBR, {OBX} } }`. On the wire that's flat:
 * `MSH, PID, [PV1], ORC, OBR, OBX...`. Every observation goes into a
 * single order group today — the IR has no order concept to split them by
 * (see docs/architecture.md).
 */
export function buildORUMessage(
	patient: PatientGraph,
	prng: PRNG,
	options: HL7ExportOptions = {},
): HL7Message {
	const [encounter] = patient.encounters;

	return [
		buildMessageHeader(
			msg("ORU", "R01", ORU_MESSAGE_STRUCTURE),
			messageDateTime(patient),
			prng,
			options,
		),
		buildPIDSegment(patient.demographics),
		...(encounter === undefined ? [] : [buildPV1Segment(encounter)]),
		...buildOrderObservationGroup(
			buildHL7Order(encounter, prng),
			1,
			patient.observations,
		),
	];
}
