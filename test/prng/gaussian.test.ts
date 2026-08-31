import { describe, expect, test } from "bun:test";
import { boxMullerGaussian } from "../../src/core/prng/gaussian.ts";

describe("boxMullerGaussian", () => {
	test("consumes exactly two draws per call and never caches a spare value", () => {
		const values = [0.25, 0.75, 0.4, 0.9];
		let calls = 0;
		const next = () => {
			const value = values[calls] ?? 0.5;
			calls++;
			return value;
		};

		boxMullerGaussian(next, 0, 1);
		expect(calls).toBe(2);

		boxMullerGaussian(next, 0, 1);
		expect(calls).toBe(4);
	});

	test("is a pure function of its two uniform inputs", () => {
		const fixed = () => {
			const queue = [0.3, 0.6];
			let i = 0;
			return () => queue[i++] ?? 0.6;
		};

		expect(boxMullerGaussian(fixed(), 50, 5)).toBe(
			boxMullerGaussian(fixed(), 50, 5),
		);
	});

	test("scales with mean and stdDev", () => {
		const source = () => {
			const queue = [0.3, 0.6];
			let i = 0;
			return () => queue[i++] ?? 0.6;
		};

		const standard = boxMullerGaussian(source(), 0, 1);
		const shifted = boxMullerGaussian(source(), 100, 1);
		const scaled = boxMullerGaussian(source(), 0, 10);

		expect(shifted).toBeCloseTo(standard + 100, 10);
		expect(scaled).toBeCloseTo(standard * 10, 10);
	});

	test("retries when the first uniform draw is exactly 0, avoiding log(0) producing NaN/Infinity", () => {
		const queue = [0, 0.5, 0.5];
		let i = 0;
		const next = () => queue[i++] ?? 0.5;

		const result = boxMullerGaussian(next, 0, 1);

		expect(Number.isFinite(result)).toBe(true);
		expect(i).toBe(3); // redrew after the leading 0
	});

	test("sample mean and stdDev roughly match the requested distribution over many draws", () => {
		let state = 987654321;
		const next = () => {
			// small local LCG, independent of Mulberry32, just to drive the statistical check
			state = (state * 1103515245 + 12345) >>> 0;
			return state / 4294967296;
		};

		const mean = 0;
		const stdDev = 1;
		const n = 5000;
		const samples: number[] = [];
		for (let i = 0; i < n; i++) {
			samples.push(boxMullerGaussian(next, mean, stdDev));
		}

		const sampleMean = samples.reduce((sum, v) => sum + v, 0) / n;
		expect(sampleMean).toBeGreaterThan(mean - 0.1);
		expect(sampleMean).toBeLessThan(mean + 0.1);
	});
});
