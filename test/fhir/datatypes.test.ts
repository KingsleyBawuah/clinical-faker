import { describe, expect, test } from "bun:test";
import {
	address,
	codeableConcept,
	coding,
	humanName,
	identifier,
	reference,
} from "../../src/fhir/datatypes.ts";

describe("reference", () => {
	test("points at an entity's urn:uuid fullUrl", () => {
		expect(reference("3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f")).toEqual({
			reference: "urn:uuid:3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f",
		});
	});
});

describe("coding", () => {
	test("carries system, code, and display", () => {
		expect(coding("http://loinc.org", "8867-4", "Heart rate")).toEqual({
			system: "http://loinc.org",
			code: "8867-4",
			display: "Heart rate",
		});
	});

	test("omits display when none is given", () => {
		expect(coding("http://loinc.org", "8867-4")).toEqual({
			system: "http://loinc.org",
			code: "8867-4",
		});
	});
});

describe("codeableConcept", () => {
	test("wraps a single coding", () => {
		expect(
			codeableConcept(coding("http://loinc.org", "8867-4", "Heart rate")),
		).toEqual({
			coding: [
				{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" },
			],
		});
	});
});

describe("humanName", () => {
	test("maps last name to family and first name to the single given name", () => {
		expect(humanName("Jane", "Baker")).toEqual({
			family: "Baker",
			given: ["Jane"],
		});
	});
});

describe("address", () => {
	test("puts the street line in R4's line array", () => {
		expect(
			address({
				line: "742 Evergreen Terrace",
				city: "Springfield",
				state: "IL",
				postalCode: "62704",
				country: "US",
			}),
		).toEqual({
			line: ["742 Evergreen Terrace"],
			city: "Springfield",
			state: "IL",
			postalCode: "62704",
			country: "US",
		});
	});
});

describe("identifier", () => {
	test("maps an NPI to the us-npi system", () => {
		expect(
			identifier({ value: "1234567893", assigningAuthority: "NPI" }),
		).toEqual({
			system: "http://hl7.org/fhir/sid/us-npi",
			value: "1234567893",
		});
	});

	test("maps a clinical-faker MRN to the library's own MRN system", () => {
		expect(
			identifier({ value: "MRN00042", assigningAuthority: "clinical-faker" }),
		).toEqual({ system: "urn:clinical-faker:mrn", value: "MRN00042" });
	});
});
