import type { PRNG } from "../../core/prng/types.ts";
import type { PatientGraph } from "../../entities/types.ts";
import { msg } from "../composites.ts";
import type { HL7ExportOptions } from "../exportOptions.ts";
import { generateMessageControlId } from "../messageControlId.ts";
import { buildAL1Segment } from "../segments/al1.ts";
import { buildDG1Segment } from "../segments/dg1.ts";
import { buildEVNSegment } from "../segments/evn.ts";
import { buildMSHSegment } from "../segments/msh.ts";
import { buildPIDSegment } from "../segments/pid.ts";
import { buildPV1Segment } from "../segments/pv1.ts";
import { toDTM } from "../toDTM.ts";
import type { HL7Message } from "../types.ts";

export type ADTEventType = "A01" | "A08";

const DEFAULT_SENDING_APPLICATION = "CLINICAL_FAKER";
const DEFAULT_SENDING_FACILITY = "CLINICAL_FAKER_FACILITY";
const DEFAULT_RECEIVING_APPLICATION = "RECEIVING_APP";
const DEFAULT_RECEIVING_FACILITY = "RECEIVING_FACILITY";
const DEFAULT_PROCESSING_ID = "P";

/**
 * Both `A01` and `A08` use the same `ADT_A01` abstract message structure —
 * confirmed against the base standard, not assumed: `A08` (Update Patient
 * Information) is one of several trigger events sharing that structure
 * rather than defining its own.
 */
const ADT_MESSAGE_STRUCTURE = "ADT_A01";

/**
 * Builds an `ADT^A01`/`ADT^A08` message: `MSH, EVN, PID, [PV1], [DG1...],
 * [AL1...]`. `PV1` is included only when the patient has an encounter — the
 * IR's `encounters` array is typed to allow zero, even though current
 * generation always produces exactly one (see docs/architecture.md).
 */
export function buildADTMessage(
	patient: PatientGraph,
	eventType: ADTEventType,
	prng: PRNG,
	options: HL7ExportOptions = {},
): HL7Message {
	const [encounter] = patient.encounters;
	const dateTime = toDTM(
		encounter !== undefined
			? encounter.period.start
			: `${patient.referenceDate}T00:00:00.000Z`,
		"datetime",
	);
	const messageControlId =
		options.messageControlId ?? generateMessageControlId(prng.fork("msh-10"));

	const msh = buildMSHSegment({
		sendingApplication:
			options.sendingApplication ?? DEFAULT_SENDING_APPLICATION,
		sendingFacility: options.sendingFacility ?? DEFAULT_SENDING_FACILITY,
		receivingApplication:
			options.receivingApplication ?? DEFAULT_RECEIVING_APPLICATION,
		receivingFacility: options.receivingFacility ?? DEFAULT_RECEIVING_FACILITY,
		dateTime,
		messageType: msg("ADT", eventType, ADT_MESSAGE_STRUCTURE),
		messageControlId,
		processingId: options.processingId ?? DEFAULT_PROCESSING_ID,
	});

	return [
		msh,
		buildEVNSegment(eventType, dateTime),
		buildPIDSegment(patient.demographics),
		...(encounter === undefined ? [] : [buildPV1Segment(encounter)]),
		...patient.conditions.map((condition, i) =>
			buildDG1Segment(condition, i + 1),
		),
		...patient.allergies.map((allergy, i) => buildAL1Segment(allergy, i + 1)),
	];
}
