import { describe, expect, test } from "bun:test";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import { generateSeededUUID } from "../../src/core/prng/uuid.ts";

const UUID_V4_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateSeededUUID", () => {
	test("produces a well-formed, RFC 4122 v4-shaped UUID", () => {
		const uuid = generateSeededUUID(createMulberry32(42));
		expect(uuid).toMatch(UUID_V4_PATTERN);
	});

	test("is well-formed across many different seeds, not just one", () => {
		for (let seed = 0; seed < 200; seed++) {
			const uuid = generateSeededUUID(createMulberry32(seed));
			expect(uuid).toMatch(UUID_V4_PATTERN);
		}
	});

	test("is deterministic: the same PRNG seed produces the same UUID", () => {
		const a = generateSeededUUID(createMulberry32(1234));
		const b = generateSeededUUID(createMulberry32(1234));
		expect(a).toBe(b);
	});

	test("different seeds produce different UUIDs", () => {
		const a = generateSeededUUID(createMulberry32(1));
		const b = generateSeededUUID(createMulberry32(2));
		expect(a).not.toBe(b);
	});

	test("consumes exactly 16 draws from the given stream", () => {
		let calls = 0;
		const prng = createMulberry32(1);
		const countingPrng = {
			...prng,
			next: () => {
				calls++;
				return prng.next();
			},
		};

		generateSeededUUID(countingPrng);
		expect(calls).toBe(16);
	});
});
