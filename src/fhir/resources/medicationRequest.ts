import type { MedicationEntity } from "../../entities/types.ts";
import { codeableConcept, coding, reference } from "../datatypes.ts";
import { RXNORM_SYSTEM } from "../systems.ts";
import type { MedicationRequest } from "../types.ts";

/** Builds an active `MedicationRequest` order; the IR's free-text `sig` becomes the dosage instruction's text. */
export function buildMedicationRequest(
	medication: MedicationEntity,
	patientId: string,
	encounterId: string,
): MedicationRequest {
	return {
		resourceType: "MedicationRequest",
		id: medication.id,
		status: "active",
		intent: "order",
		medicationCodeableConcept: codeableConcept(
			coding(RXNORM_SYSTEM, medication.rxcui, medication.name),
		),
		subject: reference(patientId),
		encounter: reference(encounterId),
		dosageInstruction: [{ text: medication.sig }],
	};
}
