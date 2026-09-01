import { createMulberry32 } from "../core/prng/mulberry32.ts";
import type { PatientGraph } from "../entities/types.ts";
import { assertExhaustive } from "./assertExhaustive.ts";
import type { HL7EventType, HL7ExportOptions } from "./exportOptions.ts";
import { buildADTMessage } from "./messages/adt.ts";
import { serializeMessage } from "./serializeMessage.ts";

/**
 * Compiles the canonical IR into an HL7 v2.5.1 message string. Derives its
 * own PRNG stream from `patient.seed`, forked by `eventType` so two
 * different message types generated from the same patient don't
 * accidentally share a message control id — the same seed and event type
 * always produce byte-identical output, matching how `.toJSON()`/`.toFHIR()`
 * already behave.
 */
export function toHL7(
	patient: PatientGraph,
	eventType: HL7EventType,
	options: HL7ExportOptions = {},
): string {
	const prng = createMulberry32(patient.seed).fork(`hl7:${eventType}`);
	switch (eventType) {
		case "ADT^A01":
			return serializeMessage(buildADTMessage(patient, "A01", prng, options));
		case "ADT^A08":
			return serializeMessage(buildADTMessage(patient, "A08", prng, options));
		default:
			return assertExhaustive(eventType);
	}
}
