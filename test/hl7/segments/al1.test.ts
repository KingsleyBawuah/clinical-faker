import { describe, expect, test } from "bun:test";
import type { AllergyEntity } from "../../../src/entities/types.ts";
import { buildAL1Segment } from "../../../src/hl7/segments/al1.ts";
import { serializeMessage } from "../../../src/hl7/serializeMessage.ts";
import { STANDARD_HL7_DELIMITERS } from "../../../src/hl7/types.ts";

const D = STANDARD_HL7_DELIMITERS;

function fieldsOf(segmentText: string | undefined): string[] {
	return (segmentText ?? "").split(D.field);
}

describe("buildAL1Segment", () => {
	test("places setId at AL1-1, the uncoded allergen at AL1-3, severity at AL1-4, and reaction at AL1-5", () => {
		const allergy: AllergyEntity = {
			substance: "Penicillin",
			reaction: "Hives",
			criticality: "high",
		};
		const [segmentText] = serializeMessage([buildAL1Segment(allergy, 1)]).split(
			"\r",
		);
		const fields = fieldsOf(segmentText);

		expect(fields[1]).toBe("1");
		expect(fields[3]).toBe(`${D.component}Penicillin${D.component}`);
		expect(fields[4]).toBe("SV");
		expect(fields[5]).toBe("Hives");
	});

	test("omits AL1-4/AL1-5 entirely when criticality/reaction aren't present", () => {
		const allergy: AllergyEntity = { substance: "Latex" };
		const [segmentText] = serializeMessage([buildAL1Segment(allergy, 1)]).split(
			"\r",
		);
		const fields = fieldsOf(segmentText);

		expect(fields.length).toBe(4); // AL1-1..AL1-3 only, id + 3 fields
	});
});
