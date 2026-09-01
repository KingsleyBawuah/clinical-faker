import { describe, expect, test } from "bun:test";
import { UnmappedHL7ValueError } from "../../../src/core/errors.ts";
import { assertExhaustive } from "../../../src/hl7/mappings/assertExhaustive.ts";

describe("assertExhaustive", () => {
	test("throws UnmappedHL7ValueError carrying the offending value — a backstop for a bypass of the `never` parameter type", () => {
		// type-coverage:ignore-next-line
		const bypassedValue = "not-a-real-case" as never;
		expect(() => assertExhaustive(bypassedValue)).toThrow(
			UnmappedHL7ValueError,
		);
		try {
			assertExhaustive(bypassedValue);
		} catch (error) {
			if (!(error instanceof UnmappedHL7ValueError)) {
				throw error;
			}
			expect(error.value).toBe("not-a-real-case");
		}
	});
});
