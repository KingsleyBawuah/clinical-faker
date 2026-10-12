import { describe, expect, test } from "bun:test";
import { toHL7ValueType } from "../../../src/hl7/mappings/valueType.ts";

describe("toHL7ValueType", () => {
	test("maps a numeric observation value to Table 0125's NM", () => {
		expect(toHL7ValueType(142)).toBe("NM");
		expect(toHL7ValueType(98.6)).toBe("NM");
	});

	test("maps a string observation value to Table 0125's ST, even when it looks numeric", () => {
		expect(toHL7ValueType("Positive")).toBe("ST");
		expect(toHL7ValueType("142")).toBe("ST");
	});
});
