import { describe, expect, test } from "bun:test";
import type { Encounter } from "../../../src/entities/types.ts";
import { buildEncounter } from "../../../src/fhir/resources/encounter.ts";

const PATIENT_ID = "3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f";
const PROVIDER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const encounter: Encounter = {
	id: "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b",
	class: "inpatient",
	period: {
		start: "2024-03-01T08:00:00.000Z",
		end: "2024-03-03T10:30:00.000Z",
	},
	location: "Ward 3A",
	attendingProvider: {
		id: PROVIDER_ID,
		identifier: { value: "1234567893", assigningAuthority: "NPI" },
		firstName: "Sam",
		lastName: "Rivera",
	},
};

describe("buildEncounter", () => {
	test("compiles a finished encounter referencing its patient and attending provider", () => {
		expect(buildEncounter(encounter, PATIENT_ID)).toEqual({
			resourceType: "Encounter",
			id: "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b",
			status: "finished",
			class: {
				system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
				code: "IMP",
			},
			subject: { reference: `urn:uuid:${PATIENT_ID}` },
			period: {
				start: "2024-03-01T08:00:00.000Z",
				end: "2024-03-03T10:30:00.000Z",
			},
			participant: [{ individual: { reference: `urn:uuid:${PROVIDER_ID}` } }],
		});
	});

	test("is in-progress, with no period.end, when the encounter hasn't ended", () => {
		const resource = buildEncounter(
			{
				...encounter,
				class: "outpatient",
				period: { start: "2024-03-01T08:00:00.000Z" },
			},
			PATIENT_ID,
		);
		expect(resource.status).toBe("in-progress");
		expect(resource.period).toEqual({ start: "2024-03-01T08:00:00.000Z" });
		expect(resource.class.code).toBe("AMB");
	});
});
