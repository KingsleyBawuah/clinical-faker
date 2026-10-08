import type { PRNG } from "../core/prng/types.ts";
import { generateMessageControlId } from "./messageControlId.ts";

/**
 * Generates a deterministic placer/filler order number (`ORC-2`/`ORC-3`,
 * `OBR-2`/`OBR-3`). Reuses `MSH-10`'s 16-hex-character format, which fits
 * the `EI` field's confirmed 22-character HL7 v2.5.1 maximum. Callers pass
 * a dedicated forked stream per number, for the same reason as
 * `generateMessageControlId`.
 */
export function generateOrderNumber(prng: PRNG): string {
	return generateMessageControlId(prng);
}
