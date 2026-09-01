import { describe, expect, test } from "bun:test";
import type { PatientGraph } from "../../src/entities/types.ts";
import { toHL7 } from "../../src/hl7/toHL7.ts";

const PATIENT: PatientGraph = {
	id: "pat-1",
	seed: 7,
	referenceDate: "2024-01-01",
	demographics: {
		firstName: "John",
		lastName: "Doe",
		dob: "1958-04-12",
		age: 65,
		gender: "male",
		mrn: { value: "MRN00042", assigningAuthority: "clinical-faker" },
		address: {
			line: "742 Evergreen Terrace",
			city: "Springfield",
			state: "IL",
			postalCode: "62704",
			country: "US",
		},
	},
	encounters: [
		{
			id: "enc-1",
			class: "inpatient",
			period: { start: "2024-03-05T14:30:07.000Z" },
			attendingProvider: {
				identifier: { value: "1234567893", assigningAuthority: "NPI" },
				firstName: "Jane",
				lastName: "Baker",
			},
		},
	],
	conditions: [],
	observations: [],
	medications: [],
	allergies: [],
};

describe("toHL7", () => {
	test("dispatches ADT^A01 to an ADT_A01-structured message with the A01 trigger event", () => {
		const message = toHL7(PATIENT, "ADT^A01");
		expect(message).toContain("ADT^A01^ADT_A01");
	});

	test("dispatches ADT^A08 to an ADT_A01-structured message with the A08 trigger event", () => {
		const message = toHL7(PATIENT, "ADT^A08");
		expect(message).toContain("ADT^A08^ADT_A01");
	});

	test("is deterministic for the same patient and event type", () => {
		expect(toHL7(PATIENT, "ADT^A01")).toBe(toHL7(PATIENT, "ADT^A01"));
	});
});
