import { describe, expect, test } from "bun:test";
import { buildEVNSegment } from "../../../src/hl7/segments/evn.ts";
import { serializeMessage } from "../../../src/hl7/serializeMessage.ts";
import { STANDARD_HL7_DELIMITERS } from "../../../src/hl7/types.ts";

const D = STANDARD_HL7_DELIMITERS;

describe("buildEVNSegment", () => {
	test("places the trigger event at EVN-1 and the recorded date/time at EVN-2", () => {
		const [segmentText] = serializeMessage([
			buildEVNSegment("A01", "20240305143007+0000"),
		]).split("\r");
		expect(segmentText).toBe(`EVN${D.field}A01${D.field}20240305143007+0000`);
	});
});
