import type { EncounterClass } from "../../entities/types.ts";
import { assertExhaustive } from "../assertExhaustive.ts";
import { ENCOUNTER_CLASS_SYSTEM } from "../systems.ts";
import type { EncounterClassCoding } from "../types.ts";

/** `Encounter.class`, from R4's ActEncounterCode value set — see docs/architecture.md's "FHIR R4 compilation" section. */
export function toFHIREncounterClass(
	encounterClass: EncounterClass,
): EncounterClassCoding {
	switch (encounterClass) {
		case "inpatient":
			return { system: ENCOUNTER_CLASS_SYSTEM, code: "IMP" };
		case "outpatient":
			return { system: ENCOUNTER_CLASS_SYSTEM, code: "AMB" };
		case "emergency":
			return { system: ENCOUNTER_CLASS_SYSTEM, code: "EMER" };
		default:
			return assertExhaustive(encounterClass);
	}
}
