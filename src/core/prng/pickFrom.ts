import type { PRNG } from "./types.ts";

/**
 * Picks a uniformly-random element from a non-empty array using the given
 * PRNG stream. `nextInt` already throws a `RangeError` for an empty array
 * (min 0 > max -1), so the `undefined` case below only exists to satisfy
 * `noUncheckedIndexedAccess` — it should never actually be reachable.
 */
export function pickFrom<T>(prng: PRNG, items: readonly T[]): T {
	const item = items[prng.nextInt(0, items.length - 1)];
	if (item === undefined) {
		throw new Error("pickFrom: items array must not be empty");
	}
	return item;
}
