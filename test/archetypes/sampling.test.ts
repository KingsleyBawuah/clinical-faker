import { describe, expect, test } from "bun:test";
import {
	computeAbnormalFlag,
	MAX_DECIMALS,
	MAX_RESAMPLE_ATTEMPTS,
	rollProbability,
	sampleObservationValue,
} from "../../src/archetypes/sampling.ts";
import type { ObservationDistributionSpec } from "../../src/archetypes/types.ts";
import {
	ClinicalFakerError,
	InvalidDecimalsError,
	InvalidProbabilityError,
	UnsatisfiableObservationSpecError,
} from "../../src/core/errors.ts";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import type { PRNG } from "../../src/core/prng/types.ts";

const MANY_DRAWS = 10_000;
const SEED_COUNT = 200;
const SAMPLES_PER_SEED = 50;

function spec(
	overrides: Partial<ObservationDistributionSpec>,
): ObservationDistributionSpec {
	return {
		loincCode: "8867-4",
		display: "Heart rate",
		unit: "/min",
		mean: 76,
		stdDev: 10,
		clamp: { min: 25, max: 220 },
		referenceRange: { low: 60, high: 100 },
		decimals: 0,
		...overrides,
	};
}

/** Wraps a PRNG and counts `next()` calls, including those made via `gaussian`. */
function countingPrng(seed: number): { prng: PRNG; draws: () => number } {
	const inner = createMulberry32(seed);
	let draws = 0;
	const next = (): number => {
		draws++;
		return inner.next();
	};
	const prng: PRNG = {
		...inner,
		next,
		nextBool: (pTrue = 0.5) => next() < pTrue,
		gaussian: (mean, stdDev) => {
			draws += 2;
			return inner.gaussian(mean, stdDev);
		},
	};
	return { prng, draws: () => draws };
}

function decimalPlaces(value: number): number {
	const [, fraction = ""] = String(value).split(".");
	return fraction.length;
}

describe("rollProbability", () => {
	test("probability 1 is always true and 0 is always false", () => {
		const prng = createMulberry32(7);
		for (let i = 0; i < MANY_DRAWS; i++) {
			expect(rollProbability(prng, 1)).toBe(true);
			expect(rollProbability(prng, 0)).toBe(false);
		}
	});

	test("consumes exactly one draw regardless of probability or outcome", () => {
		for (const probability of [0, 0.3, 0.5, 1]) {
			const { prng, draws } = countingPrng(3);
			rollProbability(prng, probability);
			expect(draws()).toBe(1);
		}
	});

	test("is deterministic: same seed gives the same sequence", () => {
		const a = createMulberry32(42);
		const b = createMulberry32(42);
		for (let i = 0; i < 100; i++) {
			expect(rollProbability(a, 0.5)).toBe(rollProbability(b, 0.5));
		}
	});

	test("comes up true at roughly the given frequency", () => {
		const prng = createMulberry32(12345);
		let trues = 0;
		for (let i = 0; i < MANY_DRAWS; i++) {
			if (rollProbability(prng, 0.3)) trues++;
		}
		expect(trues / MANY_DRAWS).toBeCloseTo(0.3, 1);
	});

	test("rejects probabilities outside [0, 1]", () => {
		const prng = createMulberry32(1);
		for (const probability of [-0.1, 1.1, Number.NaN]) {
			expect(() => rollProbability(prng, probability)).toThrow(
				InvalidProbabilityError,
			);
			try {
				rollProbability(prng, probability);
			} catch (error) {
				expect(error).toBeInstanceOf(ClinicalFakerError);
				expect(error).toBeInstanceOf(InvalidProbabilityError);
			}
		}
	});
});

describe("sampleObservationValue", () => {
	test("is deterministic: same seed gives the same values", () => {
		const a = createMulberry32(99);
		const b = createMulberry32(99);
		const potassium = spec({
			mean: 4.2,
			stdDev: 0.4,
			clamp: { min: 1.5, max: 9 },
			decimals: 1,
		});
		for (let i = 0; i < 100; i++) {
			expect(sampleObservationValue(a, potassium)).toBe(
				sampleObservationValue(b, potassium),
			);
		}
	});

	test("always stays within clamp across many seeds, even with wide tails", () => {
		// stdDev is large relative to the clamp so out-of-bounds draws are common.
		const wide = spec({
			mean: 1,
			stdDev: 2,
			clamp: { min: 0.2, max: 2.5 },
			decimals: 2,
		});
		for (let seed = 0; seed < SEED_COUNT; seed++) {
			const prng = createMulberry32(seed);
			for (let i = 0; i < SAMPLES_PER_SEED; i++) {
				const value = sampleObservationValue(prng, wide);
				expect(value).toBeGreaterThanOrEqual(wide.clamp.min);
				expect(value).toBeLessThanOrEqual(wide.clamp.max);
			}
		}
	});

	test.each([0, 1, 2, 4])("rounds to %i decimal places", (decimals) => {
		const prng = createMulberry32(decimals);
		const s = spec({
			mean: 4.2,
			stdDev: 0.4,
			clamp: { min: 1, max: 9 },
			decimals,
		});
		for (let i = 0; i < 500; i++) {
			expect(
				decimalPlaces(sampleObservationValue(prng, s)),
			).toBeLessThanOrEqual(decimals);
		}
	});

	test("resamples out-of-clamp draws instead of piling values onto the bound", () => {
		// ~32% of raw draws fall outside [-1, 1]; outright clamping would put ~16%
		// of samples on each bound.
		const tight = spec({
			mean: 0,
			stdDev: 1,
			clamp: { min: -1, max: 1 },
			decimals: 2,
		});
		const prng = createMulberry32(2024);
		let onBound = 0;
		for (let i = 0; i < MANY_DRAWS; i++) {
			const value = sampleObservationValue(prng, tight);
			if (value === tight.clamp.min || value === tight.clamp.max) onBound++;
		}
		expect(onBound / MANY_DRAWS).toBeLessThan(0.02);
	});

	test("clamps to the nearer bound once resampling is exhausted", () => {
		const below = spec({ mean: 0, stdDev: 1, clamp: { min: 100, max: 200 } });
		const above = spec({
			mean: 1000,
			stdDev: 1,
			clamp: { min: 100, max: 200 },
		});
		const prng = createMulberry32(5);
		expect(sampleObservationValue(prng, below)).toBe(100);
		expect(sampleObservationValue(prng, above)).toBe(200);
	});

	test("clamps exactly onto a bound that float scaling would nudge", () => {
		// 0.2 * 100 is 20.000000000000004; a naive ceil would yield 0.21.
		const creatinine = spec({
			mean: -50,
			stdDev: 1,
			clamp: { min: 0.2, max: 15 },
			decimals: 2,
		});
		expect(sampleObservationValue(createMulberry32(1), creatinine)).toBe(0.2);
	});

	test(`gives up after the first draw plus ${MAX_RESAMPLE_ATTEMPTS} resamples`, () => {
		const { prng, draws } = countingPrng(5);
		sampleObservationValue(
			prng,
			spec({ mean: 0, stdDev: 1, clamp: { min: 100, max: 200 } }),
		);
		expect(draws()).toBe((1 + MAX_RESAMPLE_ATTEMPTS) * 2);
	});

	test("rounding never pushes a value outside clamp", () => {
		// Bounds aren't representable at 0 decimals: 1.6 would round to 2 (> max)
		// and 0.4 to 0 (< min), so the sampler must land on 1.
		const narrow = spec({
			mean: 1,
			stdDev: 0.5,
			clamp: { min: 0.4, max: 1.6 },
			decimals: 0,
		});
		const fallbackHigh = spec({
			mean: 1000,
			stdDev: 1,
			clamp: { min: 0.4, max: 1.6 },
			decimals: 0,
		});
		const prng = createMulberry32(8);
		for (let i = 0; i < 500; i++) {
			expect(sampleObservationValue(prng, narrow)).toBe(1);
		}
		expect(sampleObservationValue(prng, fallbackHigh)).toBe(1);
	});

	test("throws when no value at the spec's precision fits within clamp", () => {
		const impossible = spec({
			mean: 1.5,
			stdDev: 0.1,
			clamp: { min: 1.2, max: 1.8 },
			decimals: 0,
		});
		expect(() =>
			sampleObservationValue(createMulberry32(1), impossible),
		).toThrow(UnsatisfiableObservationSpecError);
		try {
			sampleObservationValue(createMulberry32(1), impossible);
		} catch (error) {
			expect(error).toBeInstanceOf(ClinicalFakerError);
			expect(error).toBeInstanceOf(UnsatisfiableObservationSpecError);
		}
	});

	test("rejects decimals outside [0, MAX_DECIMALS] or non-integer", () => {
		for (const decimals of [1.5, -1, Number.NaN, 5]) {
			const s = spec({ decimals });
			expect(() => sampleObservationValue(createMulberry32(1), s)).toThrow(
				InvalidDecimalsError,
			);
			try {
				sampleObservationValue(createMulberry32(1), s);
			} catch (error) {
				expect(error).toBeInstanceOf(ClinicalFakerError);
				expect(error).toBeInstanceOf(InvalidDecimalsError);
				if (error instanceof InvalidDecimalsError) {
					if (Number.isNaN(decimals)) {
						expect(Number.isNaN(error.decimals)).toBe(true);
					} else {
						expect(error.decimals).toBe(decimals);
					}
				}
			}
		}
	});

	test("accepts valid decimals 0 and MAX_DECIMALS", () => {
		for (const decimals of [0, MAX_DECIMALS]) {
			const s = spec({ decimals });
			expect(() =>
				sampleObservationValue(createMulberry32(1), s),
			).not.toThrow();
		}
	});
});

describe("computeAbnormalFlag", () => {
	const range = { low: 60, high: 100 };

	test("values at either bound are normal", () => {
		expect(computeAbnormalFlag(60, range)).toBe("N");
		expect(computeAbnormalFlag(100, range)).toBe("N");
		expect(computeAbnormalFlag(80, range)).toBe("N");
	});

	test("values below low are L and above high are H", () => {
		expect(computeAbnormalFlag(59.99, range)).toBe("L");
		expect(computeAbnormalFlag(100.01, range)).toBe("H");
	});
});
