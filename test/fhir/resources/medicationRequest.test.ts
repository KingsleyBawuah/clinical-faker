import { describe, expect, test } from "bun:test";
import type { MedicationEntity } from "../../../src/entities/types.ts";
import { buildMedicationRequest } from "../../../src/fhir/resources/medicationRequest.ts";

const PATIENT_ID = "3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f";
const ENCOUNTER_ID = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b";

const medication: MedicationEntity = {
	id: "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f7a",
	name: "lisinopril 10 MG Oral Tablet",
	rxcui: "314076",
	sig: "Take 1 tablet by mouth once daily",
};

describe("buildMedicationRequest", () => {
	test("compiles an active order coded in RxNorm, with the sig as dosage text", () => {
		expect(
			buildMedicationRequest(medication, PATIENT_ID, ENCOUNTER_ID),
		).toEqual({
			resourceType: "MedicationRequest",
			id: "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f7a",
			status: "active",
			intent: "order",
			medicationCodeableConcept: {
				coding: [
					{
						system: "http://www.nlm.nih.gov/research/umls/rxnorm",
						code: "314076",
						display: "lisinopril 10 MG Oral Tablet",
					},
				],
			},
			subject: { reference: `urn:uuid:${PATIENT_ID}` },
			encounter: { reference: `urn:uuid:${ENCOUNTER_ID}` },
			dosageInstruction: [{ text: "Take 1 tablet by mouth once daily" }],
		});
	});
});
