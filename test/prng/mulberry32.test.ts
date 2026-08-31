import { describe, expect, test } from "bun:test";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";

describe("createMulberry32", () => {
	test("is deterministic: same seed produces the same sequence", () => {
		const a = createMulberry32(42);
		const b = createMulberry32(42);

		const sequenceA = [a.next(), a.next(), a.next()];
		const sequenceB = [b.next(), b.next(), b.next()];

		expect(sequenceA).toEqual(sequenceB);
	});

	test("different seeds produce different sequences", () => {
		const a = createMulberry32(1);
		const b = createMulberry32(2);

		expect(a.next()).not.toBe(b.next());
	});

	test("next() always returns a value in [0, 1)", () => {
		const prng = createMulberry32(123);
		for (let i = 0; i < 1000; i++) {
			const value = prng.next();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});

	test("nextFloat(min, max) stays within [min, max)", () => {
		const prng = createMulberry32(7);
		for (let i = 0; i < 1000; i++) {
			const value = prng.nextFloat(10, 20);
			expect(value).toBeGreaterThanOrEqual(10);
			expect(value).toBeLessThan(20);
		}
	});

	test("nextInt(min, max) is inclusive of both bounds and reaches them over many draws", () => {
		const prng = createMulberry32(99);
		const seen = new Set<number>();
		for (let i = 0; i < 2000; i++) {
			const value = prng.nextInt(1, 3);
			expect(Number.isInteger(value)).toBe(true);
			expect(value).toBeGreaterThanOrEqual(1);
			expect(value).toBeLessThanOrEqual(3);
			seen.add(value);
		}
		expect(seen).toEqual(new Set([1, 2, 3]));
	});

	test("nextInt(min, max) throws a RangeError when min > max, instead of returning nonsense", () => {
		const prng = createMulberry32(1);
		expect(() => prng.nextInt(10, 5)).toThrow(RangeError);
	});

	test("nextBool defaults to roughly 50/50 over many draws", () => {
		const prng = createMulberry32(55);
		let trueCount = 0;
		const total = 5000;
		for (let i = 0; i < total; i++) {
			if (prng.nextBool()) trueCount++;
		}
		expect(trueCount / total).toBeGreaterThan(0.45);
		expect(trueCount / total).toBeLessThan(0.55);
	});

	test("nextBool(pTrue) skews toward the given probability", () => {
		const prng = createMulberry32(56);
		let trueCount = 0;
		const total = 5000;
		for (let i = 0; i < total; i++) {
			if (prng.nextBool(0.9)) trueCount++;
		}
		expect(trueCount / total).toBeGreaterThan(0.85);
	});

	describe("gaussian", () => {
		test("is deterministic: same seed produces the same value", () => {
			const a = createMulberry32(42);
			const b = createMulberry32(42);
			expect(a.gaussian(100, 15)).toBe(b.gaussian(100, 15));
		});

		test("sample mean and stdDev roughly match the requested distribution over many draws", () => {
			const prng = createMulberry32(2024);
			const mean = 120;
			const stdDev = 10;
			const n = 5000;

			const samples: number[] = [];
			for (let i = 0; i < n; i++) {
				samples.push(prng.gaussian(mean, stdDev));
			}

			const sampleMean = samples.reduce((sum, v) => sum + v, 0) / n;
			const sampleVariance =
				samples.reduce((sum, v) => sum + (v - sampleMean) ** 2, 0) / n;
			const sampleStdDev = Math.sqrt(sampleVariance);

			expect(sampleMean).toBeGreaterThan(mean - 1);
			expect(sampleMean).toBeLessThan(mean + 1);
			expect(sampleStdDev).toBeGreaterThan(stdDev - 1);
			expect(sampleStdDev).toBeLessThan(stdDev + 1);
		});
	});

	describe("fork", () => {
		test("is deterministic: same seed + label produces the same child sequence", () => {
			const a = createMulberry32(42).fork("conditions");
			const b = createMulberry32(42).fork("conditions");

			expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
		});

		test("different labels produce different child streams", () => {
			const parent = createMulberry32(42);
			const childA = parent.fork("conditions");
			const childB = parent.fork("medications");

			expect(childA.next()).not.toBe(childB.next());
		});

		test("is order-independent: prior draws on the parent don't affect the fork", () => {
			const untouched = createMulberry32(42).fork("observations");

			const parent = createMulberry32(42);
			parent.next();
			parent.next();
			parent.next();
			const afterDraws = parent.fork("observations");

			expect([afterDraws.next(), afterDraws.next()]).toEqual([
				untouched.next(),
				untouched.next(),
			]);
		});

		test("a forked stream can itself be forked further", () => {
			const a = createMulberry32(1).fork("encounter").fork("observation-0");
			const b = createMulberry32(1).fork("encounter").fork("observation-0");

			expect(a.next()).toBe(b.next());
		});
	});
});
