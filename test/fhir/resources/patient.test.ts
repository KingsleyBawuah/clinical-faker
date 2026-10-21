import { describe, expect, test } from "bun:test";
import type { Demographics } from "../../../src/entities/types.ts";
import { buildPatient } from "../../../src/fhir/resources/patient.ts";

const demographics: Demographics = {
	firstName: "Jane",
	lastName: "Baker",
	dob: "1980-04-12",
	age: 44,
	gender: "female",
	phone: "+18042221111",
	mrn: { value: "MRN000123", assigningAuthority: "clinical-faker" },
	address: {
		line: "12 Example Street",
		city: "Springfield",
		state: "IL",
		postalCode: "62701",
		country: "US",
	},
};

describe("buildPatient", () => {
	test("compiles demographics into an R4 Patient with the IR's patient id", () => {
		expect(
			buildPatient("3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f", demographics),
		).toEqual({
			resourceType: "Patient",
			id: "3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f",
			identifier: [{ system: "urn:clinical-faker:mrn", value: "MRN000123" }],
			name: [{ family: "Baker", given: ["Jane"] }],
			telecom: [{ system: "phone", value: "+18042221111", use: "home" }],
			gender: "female",
			birthDate: "1980-04-12",
			address: [
				{
					line: ["12 Example Street"],
					city: "Springfield",
					state: "IL",
					postalCode: "62701",
					country: "US",
				},
			],
		});
	});
});
