import { describe, expect, test } from "bun:test";
import type { Provider } from "../../../src/entities/types.ts";
import { buildPractitioner } from "../../../src/fhir/resources/practitioner.ts";

const provider: Provider = {
	id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
	identifier: { value: "1234567893", assigningAuthority: "NPI" },
	firstName: "Sam",
	lastName: "Rivera",
};

describe("buildPractitioner", () => {
	test("compiles a provider into an R4 Practitioner keyed by the provider's IR id", () => {
		expect(buildPractitioner(provider)).toEqual({
			resourceType: "Practitioner",
			id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
			identifier: [
				{ system: "http://hl7.org/fhir/sid/us-npi", value: "1234567893" },
			],
			name: [{ family: "Rivera", given: ["Sam"] }],
		});
	});
});
