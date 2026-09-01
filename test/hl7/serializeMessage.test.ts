import { describe, expect, test } from "bun:test";
import {
	EmptyHL7MessageError,
	HL7EncodingDepthError,
	MalformedMSHSegmentError,
} from "../../src/core/errors.ts";
import { serializeMessage } from "../../src/hl7/serializeMessage.ts";
import type { HL7Message } from "../../src/hl7/types.ts";
import {
	HL7_SEGMENT_TERMINATOR,
	STANDARD_HL7_DELIMITERS,
} from "../../src/hl7/types.ts";

const D = STANDARD_HL7_DELIMITERS;

describe("serializeMessage", () => {
	test("joins a non-MSH segment's fields with the field delimiter", () => {
		const message: HL7Message = [["PID", "1", "MRN00042", "Doe"]];
		expect(serializeMessage(message)).toBe(
			`PID${D.field}1${D.field}MRN00042${D.field}Doe${HL7_SEGMENT_TERMINATOR}`,
		);
	});

	test("joins segments with a bare carriage return and terminates the message with one — never a line feed", () => {
		const message: HL7Message = [
			["EVN", "A01"],
			["PID", "1"],
		];
		const result = serializeMessage(message);
		expect(result).toBe(`EVN${D.field}A01\rPID${D.field}1\r`);
		expect(result).not.toContain("\n");
	});

	test("serializes a repeating field (multiple unstructured values in one field, joined by ~)", () => {
		const message: HL7Message = [["NK1", [["555-0100"], ["555-0199"]]]];
		expect(serializeMessage(message)).toBe(
			`NK1${D.field}555-0100${D.repetition}555-0199${HL7_SEGMENT_TERMINATOR}`,
		);
	});

	test("serializes a single (non-repeating) field's components and a component's subcomponents", () => {
		// one repetition, containing two components, the second of which has two subcomponents
		const message: HL7Message = [["PID", [["Doe", ["John", "Middle"]]]]];
		expect(serializeMessage(message)).toBe(
			`PID${D.field}Doe${D.component}John${D.subcomponent}Middle${HL7_SEGMENT_TERMINATOR}`,
		);
	});

	test("escapes a leaf value's embedded delimiter characters", () => {
		const message: HL7Message = [["OBX", "50% O2 | high"]];
		expect(serializeMessage(message)).toBe(
			`OBX${D.field}50% O2 ${D.escape}F${D.escape} high${HL7_SEGMENT_TERMINATOR}`,
		);
	});

	test("special-cases MSH: writes the field separator and encoding characters verbatim, with no extra leading separator", () => {
		const encodingCharacters = `${D.component}${D.repetition}${D.escape}${D.subcomponent}`;
		const message: HL7Message = [
			["MSH", D.field, encodingCharacters, "SENDING_APP"],
		];
		const result = serializeMessage(message);
		expect(result).toBe(
			`MSH${D.field}${encodingCharacters}${D.field}SENDING_APP${HL7_SEGMENT_TERMINATOR}`,
		);
		// regression: naive array-join would insert a second field separator in front of MSH-1's own value
		expect(result).not.toContain(`${D.field}${D.field}`);
	});

	test("throws MalformedMSHSegmentError when MSH-1 or MSH-2 is not a plain string", () => {
		const message: HL7Message = [["MSH", [D.field], "^~\\&"]];
		expect(() => serializeMessage(message)).toThrow(MalformedMSHSegmentError);
	});

	test("throws HL7EncodingDepthError when a field value nests deeper than subcomponent", () => {
		const message: HL7Message = [["OBX", [[[["too", "deep"]]]]]];
		expect(() => serializeMessage(message)).toThrow(HL7EncodingDepthError);
	});

	test("throws EmptyHL7MessageError for a zero-segment message rather than silently emitting a bare terminator", () => {
		expect(() => serializeMessage([])).toThrow(EmptyHL7MessageError);
	});

	test("an embedded carriage return in a leaf value doesn't fragment the segment it belongs to", () => {
		const message: HL7Message = [
			["EVN", "A01"],
			["OBX", "line one\rline two"],
			["PID", "1"],
		];
		const result = serializeMessage(message);
		// exactly 3 real segments (+ the trailing terminator's empty tail) — the
		// embedded \r must not have been split on as if it were a real segment boundary
		expect(result.split(HL7_SEGMENT_TERMINATOR)).toEqual([
			`EVN${D.field}A01`,
			`OBX${D.field}line one${D.escape}X0D${D.escape}line two`,
			`PID${D.field}1`,
			"",
		]);
	});
});
