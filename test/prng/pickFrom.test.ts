import { describe, expect, test } from "bun:test";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import { pickFrom } from "../../src/core/prng/pickFrom.ts";

describe("pickFrom", () => {
	test("always returns an element from the array", () => {
		const items = ["a", "b", "c"] as const;
		const prng = createMulberry32(1);
		for (let i = 0; i < 200; i++) {
			expect(items).toContain(pickFrom(prng, items));
		}
	});

	test("is deterministic: same seed picks the same element", () => {
		const items = ["a", "b", "c", "d", "e"] as const;
		const a = createMulberry32(42);
		const b = createMulberry32(42);
		expect(pickFrom(a, items)).toBe(pickFrom(b, items));
	});

	test("reaches every element over many draws", () => {
		const items = ["a", "b", "c"] as const;
		const prng = createMulberry32(99);
		const seen = new Set<string>();
		for (let i = 0; i < 500; i++) {
			seen.add(pickFrom(prng, items));
		}
		expect(seen).toEqual(new Set(items));
	});

	test("throws when the array is empty", () => {
		const prng = createMulberry32(1);
		expect(() => pickFrom(prng, [])).toThrow(RangeError);
	});
});
