import type { EncounterClass } from "../../entities/types.ts";
import { assertExhaustive } from "../assertExhaustive.ts";

/** `PV1-2` (Patient Class), HL7 v2 Table 0004. Confirmed against the base standard — see docs/architecture.md's "HL7 v2 serialization" section. */
export function toHL7PatientClass(
	encounterClass: EncounterClass,
): "I" | "O" | "E" {
	switch (encounterClass) {
		case "inpatient":
			return "I";
		case "outpatient":
			return "O";
		case "emergency":
			return "E";
		default:
			return assertExhaustive(encounterClass);
	}
}
