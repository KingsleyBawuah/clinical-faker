import type { Encounter as IREncounter } from "../../entities/types.ts";
import { reference } from "../datatypes.ts";
import { toFHIREncounterClass } from "../mappings/encounterClass.ts";
import type { Encounter } from "../types.ts";

/**
 * Builds an `Encounter` referencing its patient and attending provider by IR
 * id. The IR's free-text `location` isn't emitted: R4 only references a
 * `Location` resource there, which this library doesn't generate.
 */
export function buildEncounter(
	encounter: IREncounter,
	patientId: string,
): Encounter {
	return {
		resourceType: "Encounter",
		id: encounter.id,
		status: encounter.period.end === undefined ? "in-progress" : "finished",
		class: toFHIREncounterClass(encounter.class),
		subject: reference(patientId),
		period: { ...encounter.period },
		participant: [{ individual: reference(encounter.attendingProvider.id) }],
	};
}
