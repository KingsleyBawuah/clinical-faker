import type { PRNG } from "./types.ts";

/**
 * Draws 16 bytes from `prng` and formats them as an RFC 4122 v4-shaped UUID string.
 * Deterministic given the PRNG's seed — see docs/architecture.md's "FHIR R4
 * referential integrity" for why this replaces crypto.randomUUID() here. Callers
 * should pass a dedicated forked stream (e.g. `prng.fork("id")`) so drawing an id
 * doesn't consume randomness that would otherwise affect other generation on the
 * same stream.
 */
export function generateSeededUUID(prng: PRNG): string {
	const bytes: number[] = [];
	for (let i = 0; i < 16; i++) {
		bytes.push(Math.floor(prng.next() * 256));
	}

	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10xxxxxx

	const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
