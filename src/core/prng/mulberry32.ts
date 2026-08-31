import { boxMullerGaussian } from "./gaussian.ts";
import { deriveStreamSeed } from "./splitmix32.ts";
import type { PRNG } from "./types.ts";

/**
 * Creates a Mulberry32-backed PRNG stream from a 32-bit seed. Fast, tiny, not
 * cryptographic — see docs/architecture.md's "Seeded PRNG" for why this is the
 * right tradeoff for synthetic clinical data generation.
 */
export function createMulberry32(seed: number): PRNG {
	const originalSeed = seed >>> 0;
	let state = originalSeed;

	function next(): number {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	function nextFloat(min: number, max: number): number {
		return min + next() * (max - min);
	}

	function nextInt(min: number, max: number): number {
		return Math.floor(min + next() * (max - min + 1));
	}

	function nextBool(pTrue = 0.5): boolean {
		return next() < pTrue;
	}

	function gaussian(mean: number, stdDev: number): number {
		return boxMullerGaussian(next, mean, stdDev);
	}

	function fork(label: string): PRNG {
		return createMulberry32(deriveStreamSeed(originalSeed, label));
	}

	return { next, nextInt, nextFloat, nextBool, gaussian, fork };
}
