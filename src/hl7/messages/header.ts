import type { PRNG } from "../../core/prng/types.ts";
import type { PatientGraph } from "../../entities/types.ts";
import type { HL7ExportOptions } from "../exportOptions.ts";
import { generateMessageControlId } from "../messageControlId.ts";
import { buildMSHSegment } from "../segments/msh.ts";
import { toDTM } from "../toDTM.ts";
import type { HL7Segment, HL7Value } from "../types.ts";

const DEFAULT_SENDING_APPLICATION = "CLINICAL_FAKER";
const DEFAULT_SENDING_FACILITY = "CLINICAL_FAKER_FACILITY";
const DEFAULT_RECEIVING_APPLICATION = "RECEIVING_APP";
const DEFAULT_RECEIVING_FACILITY = "RECEIVING_FACILITY";
const DEFAULT_PROCESSING_ID = "P";

/**
 * The message's own date/time (`MSH-7`, and `EVN-2` for ADT): the
 * patient's encounter admission time when one exists, falling back to
 * `referenceDate` at midnight UTC — the IR's `encounters` array is typed to
 * allow zero, even though current generation always produces exactly one
 * (see docs/architecture.md). Never wall-clock "now", so output stays a
 * pure function of the seed.
 */
export function messageDateTime(patient: PatientGraph): string {
	const [encounter] = patient.encounters;
	return toDTM(
		encounter !== undefined
			? encounter.period.start
			: `${patient.referenceDate}T00:00:00.000Z`,
		"datetime",
	);
}

/**
 * Builds the `MSH` segment shared by every message type, applying
 * `HL7ExportOptions` overrides over this library's defaults and deriving
 * `MSH-10` from a dedicated forked stream unless overridden.
 */
export function buildMessageHeader(
	messageType: HL7Value,
	dateTime: string,
	prng: PRNG,
	options: HL7ExportOptions,
): HL7Segment {
	return buildMSHSegment({
		sendingApplication:
			options.sendingApplication ?? DEFAULT_SENDING_APPLICATION,
		sendingFacility: options.sendingFacility ?? DEFAULT_SENDING_FACILITY,
		receivingApplication:
			options.receivingApplication ?? DEFAULT_RECEIVING_APPLICATION,
		receivingFacility: options.receivingFacility ?? DEFAULT_RECEIVING_FACILITY,
		dateTime,
		messageType,
		messageControlId:
			options.messageControlId ?? generateMessageControlId(prng.fork("msh-10")),
		processingId: options.processingId ?? DEFAULT_PROCESSING_ID,
	});
}
