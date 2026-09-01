import { describe, expect, test } from "bun:test";
import { buildSegmentFromFields } from "../../../src/hl7/segments/buildSegmentFromFields.ts";

describe("buildSegmentFromFields", () => {
	test("fills every unspecified field up to the highest given field number with an empty string", () => {
		const segment = buildSegmentFromFields("PV1", {
			1: "1",
			2: "I",
			7: "provider",
		});
		expect(segment).toEqual(["PV1", "1", "I", "", "", "", "", "provider"]);
	});

	test("produces just the segment id when given no fields", () => {
		expect(buildSegmentFromFields("EVN", {})).toEqual(["EVN"]);
	});

	test("preserves nested HL7Value structure for a given field rather than flattening it", () => {
		const segment = buildSegmentFromFields("PID", { 5: [["Doe", "John"]] });
		expect(segment).toEqual(["PID", "", "", "", "", [["Doe", "John"]]]);
	});
});
