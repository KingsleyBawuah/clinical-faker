import { describe, expect, test } from "bun:test";
import { toHL7Gender } from "../../../src/hl7/mappings/gender.ts";

describe("toHL7Gender", () => {
	test("maps every Gender value to its HL7 v2 Table 0001 code", () => {
		expect(toHL7Gender("male")).toBe("M");
		expect(toHL7Gender("female")).toBe("F");
		expect(toHL7Gender("other")).toBe("O");
		expect(toHL7Gender("unknown")).toBe("U");
	});
});
