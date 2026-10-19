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
	phone: "+18042221111",
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
	test("serializes every mapped field in the correct HL7 v2 field position for +1 phone", () => {
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
				"",
				`${D.component}PRN${D.component}PH${D.component}${D.component}1${D.component}804${D.component}2221111`,
			].join(D.field),
		);
	});

	test("serializes non-+1 phone into XTN-12 at PID-13", () => {
		const nonUS = { ...DEMOGRAPHICS, phone: "+442087599036" };
		const [segmentText] = serializeMessage([buildPIDSegment(nonUS)]).split(
			"\r",
		);
		const expectedXTN12 = `${D.component}PRN${D.component}PH${D.component.repeat(9)}+442087599036`;
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
				"",
				expectedXTN12,
			].join(D.field),
		);
	});
});
