import { describe, expect, test } from "bun:test";
import { toJSON } from "../../../src/entities/exporters/toJSON.ts";
import type { PatientGraph } from "../../../src/entities/types.ts";

function samplePatient(): PatientGraph {
	return {
		id: "patient-1",
		seed: 1,
		referenceDate: "2024-01-01",
		demographics: {
			firstName: "Jane",
			lastName: "Doe",
			dob: "1980-01-01",
			age: 44,
			gender: "female",
			mrn: { value: "MRN1", assigningAuthority: "clinical-faker" },
			address: {
				line: "1 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62704",
				country: "US",
			},
		},
		encounters: [],
		conditions: [],
		observations: [
			{
				loincCode: "8480-6",
				display: "Systolic blood pressure",
				value: 130,
				effectiveDateTime: "2024-01-01T00:00:00.000Z",
			},
		],
		medications: [],
		allergies: [],
	};
}

describe("toJSON", () => {
	test("passes every PatientGraph field through unchanged", () => {
		const patient = samplePatient();
		const json = toJSON(patient);

		expect(json.id).toBe(patient.id);
		expect(json.demographics).toEqual(patient.demographics);
		expect(json.observations).toEqual(patient.observations);
	});

	test("adds a vitals projection computed from observations", () => {
		const json = toJSON(samplePatient());
		expect(json.vitals).toEqual({ systolicBp: 130 });
	});
});
