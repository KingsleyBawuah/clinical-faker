import { describe, expect, test } from "bun:test";
import type { Demographics } from "../../../src/entities/types.ts";
import { buildPIDSegment } from "../../../src/hl7/segments/pid.ts";
import { serializeMessage } from "../../../src/hl7/serializeMessage.ts";
import { STANDARD_HL7_DELIMITERS } from "../../../src/hl7/types.ts";

const D = STANDARD_HL7_DELIMITERS;

const DEMOGRAPHICS: Demographics = {
	firstName: "John",
	lastName: "Doe",
	dob: "1958-04-12",
	age: 65,
	gender: "male",
	mrn: { value: "MRN00042", assigningAuthority: "clinical-faker" },
	address: {
		line: "742 Evergreen Terrace",
		city: "Springfield",
		state: "IL",
		postalCode: "62704",
		country: "US",
	},
};

describe("buildPIDSegment", () => {
	test("serializes every mapped field in the correct HL7 v2 field position", () => {
		const [segmentText] = serializeMessage([
			buildPIDSegment(DEMOGRAPHICS),
		]).split("\r");
		expect(segmentText).toBe(
			[
				"PID",
				"1",
				"",
				`MRN00042${D.component}${D.component}${D.component}clinical-faker`,
				"",
				`Doe${D.component}John`,
				"",
				"19580412",
				"M",
				"",
				"",
				`742 Evergreen Terrace${D.component}${D.component}Springfield${D.component}IL${D.component}62704${D.component}US`,
			].join(D.field),
		);
	});
});
