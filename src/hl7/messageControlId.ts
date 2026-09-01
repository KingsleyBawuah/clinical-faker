import type { PRNG } from "../core/prng/types.ts";

/**
 * Generates a deterministic `MSH-10` (Message Control ID): 16 lowercase hex
 * characters drawn from `prng`, well within the confirmed 20-character `ST`
 * maximum for this field (see docs/architecture.md) — `generateSeededUUID`'s
 * 36-character hyphenated format is too long to reuse here. Callers should
 * pass a dedicated forked stream (e.g. `prng.fork("msh-10")`) so drawing a
 * control id doesn't consume randomness that would otherwise affect other
 * generation on the same stream.
 */
export function generateMessageControlId(prng: PRNG): string {
	const bytes: number[] = [];
	for (let i = 0; i < 8; i++) {
		bytes.push(Math.floor(prng.next() * 256));
	}
	return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
