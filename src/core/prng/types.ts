export interface PRNG {
	/** Next pseudo-random float in [0, 1). */
	next(): number;
	/** Next pseudo-random integer, inclusive of both `min` and `max`. */
	nextInt(min: number, max: number): number;
	/** Next pseudo-random float in [min, max). */
	nextFloat(min: number, max: number): number;
	/** True with probability `pTrue` (default 0.5). */
	nextBool(pTrue?: number): boolean;
	/** Next pseudo-random value from a Gaussian (normal) distribution via Box-Muller. Stateless per call. */
	gaussian(mean: number, stdDev: number): number;
	/** A decorrelated child stream derived from this stream's own seed and `label`. Pure function of (seed, label) — independent of how many draws happened before the call. */
	fork(label: string): PRNG;
}
