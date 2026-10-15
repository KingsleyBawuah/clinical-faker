import { describe, expect, test } from "bun:test";
import type { ConditionEntity } from "../../../src/entities/types.ts";
import { buildCondition } from "../../../src/fhir/resources/condition.ts";

const PATIENT_ID = "3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f";
const ENCOUNTER_ID = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b";

const condition: ConditionEntity = {
	id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
	code: "I10",
	display: "Essential (primary) hypertension",
	onsetDate: "2023-11-20",
	rank: "primary",
};

describe("buildCondition", () => {
	test("compiles an active, confirmed encounter diagnosis coded in ICD-10-CM", () => {
		expect(buildCondition(condition, PATIENT_ID, ENCOUNTER_ID)).toEqual({
			resourceType: "Condition",
			id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
			clinicalStatus: {
				coding: [
					{
						system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
						code: "active",
					},
				],
			},
			verificationStatus: {
				coding: [
					{
						system:
							"http://terminology.hl7.org/CodeSystem/condition-ver-status",
						code: "confirmed",
					},
				],
			},
			category: [
				{
					coding: [
						{
							system:
								"http://terminology.hl7.org/CodeSystem/condition-category",
							code: "encounter-diagnosis",
						},
					],
				},
			],
			code: {
				coding: [
					{
						system: "http://hl7.org/fhir/sid/icd-10-cm",
						code: "I10",
						display: "Essential (primary) hypertension",
					},
				],
			},
			subject: { reference: `urn:uuid:${PATIENT_ID}` },
			encounter: { reference: `urn:uuid:${ENCOUNTER_ID}` },
			onsetDateTime: "2023-11-20",
		});
	});

	test("omits onsetDateTime when the onset is unknown", () => {
		const { onsetDate: _, ...withoutOnset } = condition;
		const resource = buildCondition(withoutOnset, PATIENT_ID, ENCOUNTER_ID);
		expect("onsetDateTime" in resource).toBe(false);
	});
});
