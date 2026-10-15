import { describe, expect, test } from "bun:test";
import type { AllergyEntity } from "../../../src/entities/types.ts";
import { buildAllergyIntolerance } from "../../../src/fhir/resources/allergyIntolerance.ts";

const PATIENT_ID = "3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f";

const allergy: AllergyEntity = {
	id: "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b",
	substance: "Penicillin",
	reaction: "Hives",
	criticality: "high",
};

describe("buildAllergyIntolerance", () => {
	test("compiles an active, confirmed allergy with text-only substance and reaction", () => {
		expect(buildAllergyIntolerance(allergy, PATIENT_ID)).toEqual({
			resourceType: "AllergyIntolerance",
			id: "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b",
			clinicalStatus: {
				coding: [
					{
						system:
							"http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
						code: "active",
					},
				],
			},
			verificationStatus: {
				coding: [
					{
						system:
							"http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
						code: "confirmed",
					},
				],
			},
			code: { text: "Penicillin" },
			patient: { reference: `urn:uuid:${PATIENT_ID}` },
			criticality: "high",
			reaction: [{ manifestation: [{ text: "Hives" }] }],
		});
	});

	test("omits criticality and reaction when the IR has neither", () => {
		const resource = buildAllergyIntolerance(
			{ id: allergy.id, substance: "Latex" },
			PATIENT_ID,
		);
		expect("criticality" in resource).toBe(false);
		expect("reaction" in resource).toBe(false);
	});
});
