import { describe, expect, test } from "bun:test";
import { encodeHL7Text } from "../../src/hl7/encodeHL7Text.ts";
import { STANDARD_HL7_DELIMITERS } from "../../src/hl7/types.ts";

const D = STANDARD_HL7_DELIMITERS;

describe("encodeHL7Text", () => {
	test("leaves plain text with no delimiter characters untouched", () => {
		expect(encodeHL7Text("Hello World", D)).toBe("Hello World");
	});

	test("handles an empty string", () => {
		expect(encodeHL7Text("", D)).toBe("");
	});

	test("escapes each delimiter to its standard HL7 v2 escape sequence", () => {
		expect(encodeHL7Text("a|b", D)).toBe(`a${D.escape}F${D.escape}b`);
		expect(encodeHL7Text("a^b", D)).toBe(`a${D.escape}S${D.escape}b`);
		expect(encodeHL7Text("a&b", D)).toBe(`a${D.escape}T${D.escape}b`);
		expect(encodeHL7Text("a~b", D)).toBe(`a${D.escape}R${D.escape}b`);
		expect(encodeHL7Text(`a${D.escape}b`, D)).toBe(`a${D.escape}E${D.escape}b`);
	});

	test("escapes a repeated delimiter character correctly", () => {
		expect(encodeHL7Text("a||b", D)).toBe(
			`a${D.escape}F${D.escape}${D.escape}F${D.escape}b`,
		);
	});

	test("escapes the escape character first, so a literal backslash immediately followed by a delimiter doesn't corrupt the delimiter's own escape sequence", () => {
		const raw = `${D.escape}${D.field}`; // one literal backslash, then one literal pipe
		const expected = `${D.escape}E${D.escape}${D.escape}F${D.escape}`;
		expect(encodeHL7Text(raw, D)).toBe(expected);
	});

	test("escapes an embedded carriage return and line feed with the standard hex-escape sequences, since either would otherwise collide with serializeMessage's segment terminator", () => {
		expect(encodeHL7Text("line one\rline two", D)).toBe(
			`line one${D.escape}X0D${D.escape}line two`,
		);
		expect(encodeHL7Text("line one\nline two", D)).toBe(
			`line one${D.escape}X0A${D.escape}line two`,
		);
	});
});
