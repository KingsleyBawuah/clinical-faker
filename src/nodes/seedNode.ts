import type { DAGNode } from "../core/dag/types.ts";
import type { PRNG } from "../core/prng/types.ts";
import { generateSeededUUID } from "../core/prng/uuid.ts";

export interface SeedResult {
	patientId: string;
	referenceDate: string;
}

// A fixed anchor rather than wall-clock "now" — referenceDate must be a pure
// function of the seed alone, or the same seed would produce different
// output depending on which day the library happened to run.
const REFERENCE_DATE_ANCHOR_MS = Date.UTC(2024, 0, 1);
const REFERENCE_DATE_WINDOW_DAYS = 730;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function deriveReferenceDate(prng: PRNG): string {
	const offsetDays = prng.nextInt(0, REFERENCE_DATE_WINDOW_DAYS);
	const date = new Date(REFERENCE_DATE_ANCHOR_MS + offsetDays * MS_PER_DAY);
	return date.toISOString().slice(0, 10);
}

/**
 * The DAG's root node: produces the patient's own id and the deterministic
 * `referenceDate` every other node anchors its timestamps to. Every other
 * node depends on this one rather than deriving these independently.
 */
export function createSeedNode(
	prng: PRNG,
	referenceDateOverride?: string,
): DAGNode<SeedResult> {
	return {
		id: "seed",
		dependsOn: [],
		resolve: () => ({
			patientId: generateSeededUUID(prng),
			referenceDate: referenceDateOverride ?? deriveReferenceDate(prng),
		}),
	};
}
