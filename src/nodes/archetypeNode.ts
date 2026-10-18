import type { ArchetypeDefinition } from "../archetypes/types.ts";
import type { DAGNode } from "../core/dag/types.ts";
import { NoCompatibleArchetypeError } from "../core/errors.ts";
import { pickFrom } from "../core/prng/pickFrom.ts";
import type { PRNG } from "../core/prng/types.ts";
import type { Demographics } from "../entities/types.ts";

function isCompatible(
	definition: ArchetypeDefinition,
	demographics: Demographics,
): boolean {
	const constraints = definition.demographicConstraints;
	if (constraints === undefined) {
		return true;
	}

	if (
		constraints.minAge !== undefined &&
		demographics.age < constraints.minAge
	) {
		return false;
	}

	if (
		constraints.maxAge !== undefined &&
		demographics.age > constraints.maxAge
	) {
		return false;
	}

	if (
		constraints.compatibleGenders !== undefined &&
		!constraints.compatibleGenders.includes(demographics.gender)
	) {
		return false;
	}

	return true;
}

/**
 * Assigns an archetype to the patient. If `requested` is provided, it is returned
 * unchanged. Otherwise, candidates from `registry` are filtered by already-resolved
 * demographics (`demographicConstraints`: minAge/maxAge inclusive, compatibleGenders).
 * Keys are iterated in sorted order for determinism regardless of registry insertion order.
 */
export function createArchetypeNode(
	prng: PRNG,
	registry: Readonly<Record<string, ArchetypeDefinition>>,
	requested?: ArchetypeDefinition,
): DAGNode<ArchetypeDefinition> {
	return {
		id: "archetype",
		dependsOn: ["demographics"],
		resolve: (getResult) => {
			if (requested !== undefined) {
				return requested;
			}

			const demographics = getResult<Demographics>("demographics");
			const sortedKeys = Object.keys(registry).sort();
			const candidates: ArchetypeDefinition[] = [];

			for (const key of sortedKeys) {
				const candidate = registry[key];
				if (candidate !== undefined && isCompatible(candidate, demographics)) {
					candidates.push(candidate);
				}
			}

			if (candidates.length === 0) {
				throw new NoCompatibleArchetypeError(
					demographics.age,
					demographics.gender,
				);
			}

			return pickFrom(prng, candidates);
		},
	};
}
