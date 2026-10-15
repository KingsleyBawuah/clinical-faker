import { describe, expect, test } from "bun:test";
import { toFHIRIdentifierSystem } from "../../src/fhir/systems.ts";

describe("toFHIRIdentifierSystem", () => {
	test("maps every AssigningAuthority to its identifier system URI", () => {
		expect(toFHIRIdentifierSystem("NPI")).toBe(
			"http://hl7.org/fhir/sid/us-npi",
		);
		expect(toFHIRIdentifierSystem("clinical-faker")).toBe(
			"urn:clinical-faker:mrn",
		);
	});
});
