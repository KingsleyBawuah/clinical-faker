import { describe, expect, test } from "bun:test";
import type { ObservationEntity } from "../../../src/entities/types.ts";
import { buildOBXSegment } from "../../../src/hl7/segments/obx.ts";
import { serializeMessage } from "../../../src/hl7/serializeMessage.ts";
import { STANDARD_HL7_DELIMITERS } from "../../../src/hl7/types.ts";

const D = STANDARD_HL7_DELIMITERS;

const SYSTOLIC: ObservationEntity = {
	loincCode: "8480-6",
	display: "Systolic blood pressure",
	value: 152,
	unit: "mm[Hg]",
	effectiveDateTime: "2024-03-05T15:00:00.000Z",
	referenceRange: { low: 90, high: 120 },
	abnormalFlag: "H",
};

describe("buildOBXSegment", () => {
	test("places every populated field at its HL7 v2.5.1 position for a numeric result", () => {
		const [segmentText] = serializeMessage([
			buildOBXSegment(SYSTOLIC, 1),
		]).split("\r");
		expect(segmentText).toBe(
			[
				"OBX",
				"1",
				"NM",
				`8480-6${D.component}Systolic blood pressure${D.component}LN`,
				"",
				"152",
				`mm[Hg]${D.component}mm[Hg]${D.component}UCUM`,
				"90-120",
				"H",
				"",
				"",
				"F",
				"",
				"",
				"20240305150000+0000",
			].join(D.field),
		);
	});

	test("uses ST and leaves units/reference range/abnormal flag empty when the observation has none", () => {
		const observation: ObservationEntity = {
			loincCode: "5778-6",
			display: "Color of Urine",
			value: "Yellow",
			effectiveDateTime: "2024-03-05T15:00:00.000Z",
		};
		const segment = buildOBXSegment(observation, 3);
		expect(segment[1]).toBe("3"); // OBX-1 Set ID
		expect(segment[2]).toBe("ST"); // OBX-2 Value Type
		expect(segment[5]).toBe("Yellow"); // OBX-5 Observation Value
		expect(segment[6]).toBe(""); // OBX-6 Units
		expect(segment[7]).toBe(""); // OBX-7 References Range
		expect(segment[8]).toBe(""); // OBX-8 Abnormal Flags
		expect(segment[11]).toBe("F"); // OBX-11 Observation Result Status (required)
	});
});
