/**
 * Box-Muller transform: converts uniform draws from `next` into a Gaussian (normal)
 * distributed value. Stateless per call — always consumes two fresh uniform draws and
 * never caches the transform's second output across calls (see docs/architecture.md's
 * "Seeded PRNG" implementation requirements for why).
 */
export function boxMullerGaussian(
	next: () => number,
	mean: number,
	stdDev: number,
): number {
	let u1 = 0;
	do {
		u1 = next();
	} while (u1 === 0);
	const u2 = next();

	const magnitude = Math.sqrt(-2 * Math.log(u1));
	const z0 = magnitude * Math.cos(2 * Math.PI * u2);

	return mean + z0 * stdDev;
}
