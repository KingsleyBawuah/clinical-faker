/**
 * Derives a decorrelated 32-bit seed from a master seed and a label, via a single
 * SplitMix32 mixing step. Same (masterSeed, label) always produces the same output;
 * different labels produce well-separated outputs even when masterSeed is identical.
 */
export function deriveStreamSeed(masterSeed: number, label: string): number {
	const combined = (masterSeed ^ hashLabel(label)) >>> 0;
	return splitMix32Step(combined) >>> 0;
}

/** FNV-1a 32-bit hash, used only to fold a string label into a numeric seed component. */
function hashLabel(label: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < label.length; i++) {
		hash ^= label.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** One SplitMix32 avalanche-mix step over `state`. */
function splitMix32Step(state: number): number {
	const a = (state + 0x9e3779b9) | 0;
	let t = a ^ (a >>> 16);
	t = Math.imul(t, 0x21f0aaad);
	t = t ^ (t >>> 15);
	t = Math.imul(t, 0x735a2d97);
	t = t ^ (t >>> 15);
	return t >>> 0;
}
