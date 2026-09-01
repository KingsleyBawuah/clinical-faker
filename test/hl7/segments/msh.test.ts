import { describe, expect, test } from "bun:test";
import { InvalidMessageControlIdError } from "../../../src/core/errors.ts";
import { buildMSHSegment } from "../../../src/hl7/segments/msh.ts";
import { serializeMessage } from "../../../src/hl7/serializeMessage.ts";
import {
	HL7_SEGMENT_TERMINATOR,
	STANDARD_HL7_DELIMITERS,
} from "../../../src/hl7/types.ts";
import { HL7_VERSION } from "../../../src/hl7/version.ts";

const D = STANDARD_HL7_DELIMITERS;

const BASE_FIELDS = {
	sendingApplication: "CLINICAL_FAKER",
	sendingFacility: "CLINICAL_FAKER_FACILITY",
	receivingApplication: "RECEIVING_APP",
	receivingFacility: "RECEIVING_FACILITY",
	dateTime: "20240305143007+0000",
	messageType: [["ADT", "A01", "ADT_A01"]] as const,
	messageControlId: "0123456789abcdef",
	processingId: "P" as const,
};

describe("buildMSHSegment", () => {
	test("derives MSH-1/MSH-2 from the given delimiters and serializes without a doubled field separator", () => {
		const segment = buildMSHSegment(BASE_FIELDS);
		const result = serializeMessage([segment]);
		expect(result).toBe(
			`MSH${D.field}${D.component}${D.repetition}${D.escape}${D.subcomponent}${D.field}CLINICAL_FAKER${D.field}CLINICAL_FAKER_FACILITY${D.field}RECEIVING_APP${D.field}RECEIVING_FACILITY${D.field}20240305143007+0000${D.field}${D.field}ADT${D.component}A01${D.component}ADT_A01${D.field}0123456789abcdef${D.field}P${D.field}${HL7_VERSION}${HL7_SEGMENT_TERMINATOR}`,
		);
	});

	test("defaults versionId to HL7_VERSION when not overridden", () => {
		const segment = buildMSHSegment(BASE_FIELDS);
		expect(segment[12]).toBe(HL7_VERSION);
	});

	test("throws InvalidMessageControlIdError for a control id over 20 characters", () => {
		expect(() =>
			buildMSHSegment({ ...BASE_FIELDS, messageControlId: "x".repeat(21) }),
		).toThrow(InvalidMessageControlIdError);
	});

	test("accepts a control id of exactly 20 characters", () => {
		expect(() =>
			buildMSHSegment({ ...BASE_FIELDS, messageControlId: "x".repeat(20) }),
		).not.toThrow();
	});
});
