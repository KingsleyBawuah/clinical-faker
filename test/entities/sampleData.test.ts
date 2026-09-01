import { describe, expect, test } from "bun:test";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import {
	pickAddress,
	pickFirstName,
	pickGender,
	pickLastName,
} from "../../src/entities/sampleData.ts";
import type { Gender } from "../../src/entities/types.ts";

describe("pickGender", () => {
	test("only ever produces a valid Gender value", () => {
		const prng = createMulberry32(1);
		const valid: readonly Gender[] = ["male", "female", "other", "unknown"];
		for (let i = 0; i < 500; i++) {
			expect(valid).toContain(pickGender(prng));
		}
	});

	test("is weighted toward male/female over many draws", () => {
		const prng = createMulberry32(2);
		const counts: Record<Gender, number> = {
			male: 0,
			female: 0,
			other: 0,
			unknown: 0,
		};
		const total = 5000;
		for (let i = 0; i < total; i++) {
			counts[pickGender(prng)]++;
		}
		expect((counts.male + counts.female) / total).toBeGreaterThan(0.9);
	});

	test("is deterministic: same seed produces the same gender", () => {
		const a = createMulberry32(42);
		const b = createMulberry32(42);
		expect(pickGender(a)).toBe(pickGender(b));
	});
});

describe("pickFirstName", () => {
	test("returns a non-empty name for every gender", () => {
		const prng = createMulberry32(3);
		for (const gender of ["male", "female", "other", "unknown"] as const) {
			const name = pickFirstName(prng, gender);
			expect(typeof name).toBe("string");
			expect(name.length).toBeGreaterThan(0);
		}
	});

	test("is deterministic: same seed and gender produce the same name", () => {
		const a = createMulberry32(7);
		const b = createMulberry32(7);
		expect(pickFirstName(a, "female")).toBe(pickFirstName(b, "female"));
	});

	test("is deterministic for the combined other/unknown pool too", () => {
		for (const gender of ["other", "unknown"] as const) {
			const a = createMulberry32(9);
			const b = createMulberry32(9);
			expect(pickFirstName(a, gender)).toBe(pickFirstName(b, gender));
		}
	});
});

describe("pickLastName", () => {
	test("returns a non-empty, deterministic name", () => {
		const a = createMulberry32(11);
		const b = createMulberry32(11);
		const name = pickLastName(a);
		expect(name.length).toBeGreaterThan(0);
		expect(pickLastName(b)).toBe(name);
	});
});

describe("pickAddress", () => {
	test("returns a fully populated, plausible US address", () => {
		const prng = createMulberry32(13);
		const address = pickAddress(prng);

		expect(address.line.length).toBeGreaterThan(0);
		expect(address.city.length).toBeGreaterThan(0);
		expect(address.state).toMatch(/^[A-Z]{2}$/);
		expect(address.postalCode).toMatch(/^\d{5}$/);
		expect(address.country).toBe("US");
	});

	test("is deterministic: same seed produces the same address", () => {
		const a = createMulberry32(21);
		const b = createMulberry32(21);
		expect(pickAddress(a)).toEqual(pickAddress(b));
	});
});
