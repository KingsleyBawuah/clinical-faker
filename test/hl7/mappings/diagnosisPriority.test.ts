import { describe, expect, test } from "bun:test";
import { toHL7DiagnosisPriority } from "../../../src/hl7/mappings/diagnosisPriority.ts";

describe("toHL7DiagnosisPriority", () => {
	test("maps every ConditionRank value to its DG1-15 code", () => {
		expect(toHL7DiagnosisPriority("primary")).toBe("1");
		expect(toHL7DiagnosisPriority("secondary")).toBe("2");
	});
});
