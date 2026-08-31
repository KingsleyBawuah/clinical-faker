import { describe, expect, test } from "bun:test";
import { deriveStreamSeed } from "../../src/core/prng/splitmix32.ts";

describe("deriveStreamSeed", () => {
	test("is deterministic: same seed + label always produces the same output", () => {
		expect(deriveStreamSeed(42, "demographics")).toBe(
			deriveStreamSeed(42, "demographics"),
		);
	});

	test("decorrelates by label: different labels produce different outputs for the same seed", () => {
		const a = deriveStreamSeed(42, "demographics");
		const b = deriveStreamSeed(42, "conditions");
		const c = deriveStreamSeed(42, "medications");

		expect(a).not.toBe(b);
		expect(b).not.toBe(c);
		expect(a).not.toBe(c);
	});

	test("decorrelates by seed: different seeds produce different outputs for the same label", () => {
		expect(deriveStreamSeed(1, "demographics")).not.toBe(
			deriveStreamSeed(2, "demographics"),
		);
	});

	test("always returns an unsigned 32-bit integer", () => {
		for (const label of ["a", "b", "encounterNode", ""]) {
			const value = deriveStreamSeed(7, label);
			expect(Number.isInteger(value)).toBe(true);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(2 ** 32);
		}
	});
});
