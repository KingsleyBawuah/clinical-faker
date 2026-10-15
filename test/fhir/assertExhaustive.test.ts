import { describe, expect, test } from "bun:test";
import { UnmappedFHIRValueError } from "../../src/core/errors.ts";
import { assertExhaustive } from "../../src/fhir/assertExhaustive.ts";

describe("assertExhaustive (FHIR)", () => {
	test("throws UnmappedFHIRValueError carrying the offending value — a backstop for a bypass of the `never` parameter type", () => {
		// type-coverage:ignore-next-line
		const bypassedValue = "not-a-real-case" as never;
		expect(() => assertExhaustive(bypassedValue)).toThrow(
			UnmappedFHIRValueError,
		);
		try {
			assertExhaustive(bypassedValue);
		} catch (error) {
			if (!(error instanceof UnmappedFHIRValueError)) {
				throw error;
			}
			expect(error.value).toBe("not-a-real-case");
		}
	});
});
