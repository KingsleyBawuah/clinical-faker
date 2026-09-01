import { describe, expect, test } from "bun:test";
import { cx, msg, xad, xcn, xpn } from "../../src/hl7/composites.ts";
import { serializeMessage } from "../../src/hl7/serializeMessage.ts";
import type { HL7Message } from "../../src/hl7/types.ts";
import { STANDARD_HL7_DELIMITERS } from "../../src/hl7/types.ts";

const D = STANDARD_HL7_DELIMITERS;

// Each composite is exercised through serializeMessage rather than by
// inspecting its raw HL7Value shape directly, since the actual contract
// that matters is "what wire text does this produce" — the same contract
// PR 2a's own tests check the serializer against.
function serializeField(field: ReturnType<typeof xpn>): string {
	const message: HL7Message = [["OBX", field]];
	const [segmentText] = serializeMessage(message).split("\r");
	return segmentText?.slice(`OBX${D.field}`.length) ?? "";
}

describe("xpn", () => {
	test("serializes as family name ^ given name, with no repetition delimiter", () => {
		expect(serializeField(xpn("Doe", "John"))).toBe(`Doe${D.component}John`);
	});
});

describe("xad", () => {
	test("serializes as street ^^ city ^ state ^ zip ^ country, leaving 'other designation' empty", () => {
		const field = xad({
			line: "123 Main St",
			city: "Springfield",
			state: "IL",
			postalCode: "62704",
			country: "US",
		});
		expect(serializeField(field)).toBe(
			`123 Main St${D.component}${D.component}Springfield${D.component}IL${D.component}62704${D.component}US`,
		);
	});
});

describe("cx", () => {
	test("serializes as id number ^^^ assigning authority, leaving check-digit components empty", () => {
		const field = cx({
			value: "MRN00042",
			assigningAuthority: "clinical-faker",
		});
		expect(serializeField(field)).toBe(
			`MRN00042${D.component}${D.component}${D.component}clinical-faker`,
		);
	});
});

describe("xcn", () => {
	test("serializes as id number ^ family name ^ given name", () => {
		const field = xcn({
			identifier: { value: "1234567893", assigningAuthority: "NPI" },
			firstName: "Jane",
			lastName: "Baker",
		});
		expect(serializeField(field)).toBe(
			`1234567893${D.component}Baker${D.component}Jane`,
		);
	});
});

describe("msg", () => {
	test("serializes as message code ^ trigger event ^ message structure, with no repetition delimiter", () => {
		// regression: a bare array here (["ADT","A01","ADT_A01"]) would be read
		// as three repetitions (~) instead of three components (^) of MSH-9
		expect(serializeField(msg("ADT", "A01", "ADT_A01"))).toBe(
			`ADT${D.component}A01${D.component}ADT_A01`,
		);
	});
});
