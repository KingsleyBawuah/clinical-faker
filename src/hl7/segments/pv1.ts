import type { Encounter } from "../../entities/types.ts";
import { xcn } from "../composites.ts";
import { toHL7PatientClass } from "../mappings/patientClass.ts";
import { toDTM } from "../toDTM.ts";
import type { HL7Segment } from "../types.ts";
import { buildSegmentFromFields } from "./buildSegmentFromFields.ts";

/**
 * Builds a `PV1` segment from an `Encounter`. `PV1-1` (Set ID) is hardcoded
 * to `"1"` for the same reason as `PID-1`. `PV1-7` (attending doctor) is
 * reused verbatim as `PV1-17` (admitting doctor) — a deliberate MVP
 * simplification already documented in docs/architecture.md's canonical IR
 * section, since `Encounter` only models one provider role.
 */
export function buildPV1Segment(encounter: Encounter): HL7Segment {
	const provider = xcn(encounter.attendingProvider);
	return buildSegmentFromFields("PV1", {
		1: "1",
		2: toHL7PatientClass(encounter.class),
		...(encounter.location === undefined ? {} : { 3: encounter.location }),
		7: provider,
		17: provider,
		44: toDTM(encounter.period.start, "datetime"),
		...(encounter.period.end === undefined
			? {}
			: { 45: toDTM(encounter.period.end, "datetime") }),
	});
}
