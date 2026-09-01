import { describe, expect, test } from "bun:test";
import { toDTM } from "../../src/hl7/toDTM.ts";

describe("toDTM", () => {
	test("formats a date-only ISO string as YYYYMMDD, no punctuation", () => {
		expect(toDTM("2024-03-05", "date")).toBe("20240305");
	});

	test("formats an ISO datetime as YYYYMMDDHHMMSS with an explicit +0000 offset", () => {
		expect(toDTM("2024-03-05T14:30:07.000Z", "datetime")).toBe(
			"20240305143007+0000",
		);
	});

	test("zero-pads single-digit month, day, hour, minute, and second", () => {
		expect(toDTM("2024-01-02", "date")).toBe("20240102");
		expect(toDTM("2024-01-02T03:04:05.000Z", "datetime")).toBe(
			"20240102030405+0000",
		);
	});
});
