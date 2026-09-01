import { describe, expect, test } from "bun:test";
import { toHL7AllergySeverity } from "../../../src/hl7/mappings/allergySeverity.ts";

describe("toHL7AllergySeverity", () => {
	test("maps every AllergyCriticality value to its HL7 v2 Table 0128 code", () => {
		expect(toHL7AllergySeverity("low")).toBe("MI");
		expect(toHL7AllergySeverity("high")).toBe("SV");
		expect(toHL7AllergySeverity("unable-to-assess")).toBe("U");
	});
});
