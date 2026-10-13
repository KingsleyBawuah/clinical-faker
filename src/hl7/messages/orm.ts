import type { PRNG } from "../../core/prng/types.ts";
import type { PatientGraph } from "../../entities/types.ts";
import { msg } from "../composites.ts";
import type { HL7ExportOptions } from "../exportOptions.ts";
import { buildCommonOrderSegments } from "../groups/commonOrder.ts";
import { buildHL7Order } from "../order.ts";
import { buildPIDSegment } from "../segments/pid.ts";
import { buildPV1Segment } from "../segments/pv1.ts";
import type { HL7Message } from "../types.ts";
import { buildMessageHeader, messageDateTime } from "./header.ts";

/** `ORM^O01`'s abstract message structure, confirmed against `hl7v2-dictionary`'s HL7 v2.5.1 message definitions. */
const ORM_MESSAGE_STRUCTURE = "ORM_O01";

/**
 * Builds an `ORM^O01` message: `MSH, [PATIENT{ PID, [PATIENT_VISIT{ PV1 }] }],
 * { ORDER{ ORC, [ORDER_DETAIL{ OBR }] } }`. On the wire that's flat:
 * `MSH, PID, [PV1], ORC, OBR`. A new order (`ORC-1` `NW`) has no results
 * yet, so there are no `OBX`s and `OBR-7`/`OBR-25` stay empty.
 */
export function buildORMMessage(
	patient: PatientGraph,
	prng: PRNG,
	options: HL7ExportOptions = {},
): HL7Message {
	const [encounter] = patient.encounters;

	return [
		buildMessageHeader(
			msg("ORM", "O01", ORM_MESSAGE_STRUCTURE),
			messageDateTime(patient),
			prng,
			options,
		),
		buildPIDSegment(patient.demographics),
		...(encounter === undefined ? [] : [buildPV1Segment(encounter)]),
		...buildCommonOrderSegments(buildHL7Order(encounter, prng), "NW", 1),
	];
}
