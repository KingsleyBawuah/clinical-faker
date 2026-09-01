import { describe, expect, test } from "bun:test";
import { toHL7PatientClass } from "../../../src/hl7/mappings/patientClass.ts";

describe("toHL7PatientClass", () => {
	test("maps every EncounterClass value to its HL7 v2 Table 0004 code", () => {
		expect(toHL7PatientClass("inpatient")).toBe("I");
		expect(toHL7PatientClass("outpatient")).toBe("O");
		expect(toHL7PatientClass("emergency")).toBe("E");
	});
});
