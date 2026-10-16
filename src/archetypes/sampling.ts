import type { PRNG } from "../core/prng/types.ts";
import type { AbnormalFlag } from "../entities/types.ts";
import type { ObservationDistributionSpec } from "./types.ts";

/**
 * How many times `sampleObservationValue` redraws after a first draw lands
 * outside `clamp`, before falling back to clamping. Small on purpose: a spec
 * whose clamp is so far from its mean that this runs out is a data bug.
 */
export const MAX_RESAMPLE_ATTEMPTS = 10;

/** Scaled-value slack for float error, e.g. `0.2 * 100` is `20.000000000000004`. */
const SCALED_TOLERANCE = 1e-9;

/** Rounds `scaled` with `round`, unless it's already an integer up to float error. */
function snapScaled(scaled: number, round: (x: number) => number): number {
	const nearest = Math.round(scaled);
	return Math.abs(scaled - nearest) < SCALED_TOLERANCE
		? nearest
		: round(scaled);
}

/**
 * True with the given probability. Always consumes exactly one draw, so how
 * much of the stream a roll uses never depends on the probability or outcome.
 */
export function rollProbability(prng: PRNG, probability: number): boolean {
	if (!(probability >= 0 && probability <= 1)) {
		throw new RangeError(
			`rollProbability: probability (${probability}) must be in [0, 1]`,
		);
	}
	// next() is in [0, 1), so 1 is always true and 0 always false.
	return prng.next() < probability;
}

/**
 * Draws a value from the spec's Gaussian, bounded by `clamp` and rounded to
 * `decimals` — see docs/architecture.md's "Gaussian sampling is bounded".
 * Out-of-clamp draws are resampled; clamping is only the last resort, so
 * values don't pile up on the bounds.
 */
export function sampleObservationValue(
	prng: PRNG,
	spec: ObservationDistributionSpec,
): number {
	const { mean, stdDev, clamp, decimals } = spec;
	const scale = 10 ** decimals;
	// The tightest bounds that are representable at `decimals`, so rounding
	// can never land a value outside clamp.
	const min = snapScaled(clamp.min * scale, Math.ceil) / scale;
	const max = snapScaled(clamp.max * scale, Math.floor) / scale;
	if (min > max) {
		throw new RangeError(
			`sampleObservationValue: no value with ${decimals} decimal places fits clamp [${clamp.min}, ${clamp.max}] for LOINC ${spec.loincCode}`,
		);
	}

	let value = prng.gaussian(mean, stdDev);
	for (
		let attempt = 0;
		attempt < MAX_RESAMPLE_ATTEMPTS && (value < clamp.min || value > clamp.max);
		attempt++
	) {
		value = prng.gaussian(mean, stdDev);
	}

	const rounded = Math.round(value * scale) / scale;
	return Math.min(max, Math.max(min, rounded));
}

/** Pure function of `value` vs `referenceRange`; a value equal to either bound is normal. */
export function computeAbnormalFlag(
	value: number,
	referenceRange: { readonly low: number; readonly high: number },
): AbnormalFlag {
	if (value < referenceRange.low) return "L";
	if (value > referenceRange.high) return "H";
	return "N";
}
