import { describe, expect, test } from "bun:test";
import { toFHIREncounterClass } from "../../../src/fhir/mappings/encounterClass.ts";

describe("toFHIREncounterClass", () => {
	test("maps every EncounterClass value to its v3-ActCode coding", () => {
		const system = "http://terminology.hl7.org/CodeSystem/v3-ActCode";
		expect(toFHIREncounterClass("inpatient")).toEqual({ system, code: "IMP" });
		expect(toFHIREncounterClass("outpatient")).toEqual({ system, code: "AMB" });
		expect(toFHIREncounterClass("emergency")).toEqual({
			system,
			code: "EMER",
		});
	});
});
