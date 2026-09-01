import { describe, expect, test } from "bun:test";
import type { ConditionEntity } from "../../../src/entities/types.ts";
import { buildDG1Segment } from "../../../src/hl7/segments/dg1.ts";
import { serializeMessage } from "../../../src/hl7/serializeMessage.ts";
import { STANDARD_HL7_DELIMITERS } from "../../../src/hl7/types.ts";

const D = STANDARD_HL7_DELIMITERS;

describe("buildDG1Segment", () => {
	test("places setId at DG1-1, the coded diagnosis at DG1-3, and priority at DG1-15, defaulting DG1-6 to Admitting", () => {
		const condition: ConditionEntity = {
			code: "I10",
			display: "Essential hypertension",
			rank: "primary",
		};
		const [segmentText] = serializeMessage([
			buildDG1Segment(condition, 1),
		]).split("\r");
		expect(segmentText).toBe(
			[
				"DG1",
				"1",
				"",
				`I10${D.component}Essential hypertension${D.component}I10`,
				"",
				"",
				"A",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"1",
			].join(D.field),
		);
	});

	test("maps a secondary condition's rank to DG1-15's priority 2", () => {
		const condition: ConditionEntity = {
			code: "E78.5",
			display: "Hyperlipidemia, unspecified",
			rank: "secondary",
		};
		const segment = buildDG1Segment(condition, 2);
		expect(segment[1]).toBe("2"); // DG1-1 Set ID
		expect(segment[15]).toBe("2"); // DG1-15 Diagnosis Priority
	});
});
