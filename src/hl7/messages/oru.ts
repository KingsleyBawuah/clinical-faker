import type { PRNG } from "../../core/prng/types.ts";
import type { PatientGraph } from "../../entities/types.ts";
import { msg } from "../composites.ts";
import type { HL7ExportOptions } from "../exportOptions.ts";
import { buildOrderObservationGroup } from "../groups/orderObservation.ts";
import type { HL7Order } from "../order.ts";
import { generateOrderNumber } from "../orderNumber.ts";
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
 * (see docs/architecture.md). Placer/filler order numbers each come from
 * their own forked stream, so they're stable per seed and independent of
 * `MSH-10`.
 */
export function buildORUMessage(
	patient: PatientGraph,
	prng: PRNG,
	options: HL7ExportOptions = {},
): HL7Message {
	const [encounter] = patient.encounters;
	const order: HL7Order = {
		placerOrderNumber: generateOrderNumber(prng.fork("placer-order-number")),
		fillerOrderNumber: generateOrderNumber(prng.fork("filler-order-number")),
		...(encounter === undefined
			? {}
			: { orderingProvider: encounter.attendingProvider }),
	};

	return [
		buildMessageHeader(
			msg("ORU", "R01", ORU_MESSAGE_STRUCTURE),
			messageDateTime(patient),
			prng,
			options,
		),
		buildPIDSegment(patient.demographics),
		...(encounter === undefined ? [] : [buildPV1Segment(encounter)]),
		...buildOrderObservationGroup(order, 1, patient.observations),
	];
}
