import type { AllergyEntity } from "../../entities/types.ts";
import { codeableConcept, coding, reference } from "../datatypes.ts";
import {
	ALLERGY_CLINICAL_SYSTEM,
	ALLERGY_VERIFICATION_SYSTEM,
} from "../systems.ts";
import type { AllergyIntolerance } from "../types.ts";

/**
 * Builds an active, confirmed `AllergyIntolerance`. The IR has no coded
 * substance or reaction, so both are text-only `CodeableConcept`s. The IR's
 * `AllergyCriticality` matches R4's value for value.
 */
export function buildAllergyIntolerance(
	allergy: AllergyEntity,
	patientId: string,
): AllergyIntolerance {
	const resource: AllergyIntolerance = {
		resourceType: "AllergyIntolerance",
		id: allergy.id,
		clinicalStatus: codeableConcept(coding(ALLERGY_CLINICAL_SYSTEM, "active")),
		verificationStatus: codeableConcept(
			coding(ALLERGY_VERIFICATION_SYSTEM, "confirmed"),
		),
		code: { text: allergy.substance },
		patient: reference(patientId),
	};
	if (allergy.criticality !== undefined) {
		resource.criticality = allergy.criticality;
	}
	if (allergy.reaction !== undefined) {
		resource.reaction = [{ manifestation: [{ text: allergy.reaction }] }];
	}
	return resource;
}
