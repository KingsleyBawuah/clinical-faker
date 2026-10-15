import type { ConditionEntity } from "../../entities/types.ts";
import { codeableConcept, coding, reference } from "../datatypes.ts";
import {
	CONDITION_CATEGORY_SYSTEM,
	CONDITION_CLINICAL_SYSTEM,
	CONDITION_VERIFICATION_SYSTEM,
	ICD10CM_SYSTEM,
} from "../systems.ts";
import type { Condition } from "../types.ts";

/**
 * Builds an `encounter-diagnosis` `Condition` for the encounter it was
 * diagnosed in. The IR's `rank` isn't emitted: R4 puts diagnosis rank on
 * `Encounter.diagnosis`, not on `Condition`.
 */
export function buildCondition(
	condition: ConditionEntity,
	patientId: string,
	encounterId: string,
): Condition {
	const resource: Condition = {
		resourceType: "Condition",
		id: condition.id,
		clinicalStatus: codeableConcept(
			coding(CONDITION_CLINICAL_SYSTEM, "active"),
		),
		verificationStatus: codeableConcept(
			coding(CONDITION_VERIFICATION_SYSTEM, "confirmed"),
		),
		category: [
			codeableConcept(coding(CONDITION_CATEGORY_SYSTEM, "encounter-diagnosis")),
		],
		code: codeableConcept(
			coding(ICD10CM_SYSTEM, condition.code, condition.display),
		),
		subject: reference(patientId),
		encounter: reference(encounterId),
	};
	if (condition.onsetDate !== undefined) {
		resource.onsetDateTime = condition.onsetDate;
	}
	return resource;
}
