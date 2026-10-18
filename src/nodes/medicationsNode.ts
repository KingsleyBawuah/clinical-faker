import { rollProbability } from "../archetypes/sampling.ts";
import type { ArchetypeDefinition } from "../archetypes/types.ts";
import type { DAGNode } from "../core/dag/types.ts";
import type { PRNG } from "../core/prng/types.ts";
import { generateSeededUUID } from "../core/prng/uuid.ts";
import type { ConditionEntity, MedicationEntity } from "../entities/types.ts";

/**
 * Produces `MedicationEntity` records from the resolved archetype's `MedicationSpec`s:
 * - When `forCondition` is set, the medication is gated by the generated conditions:
 *   if no condition with that code was generated, the medication is skipped.
 * - Otherwise, the medication is included if `rollProbability` succeeds on its
 *   forked stream.
 * - Each entity id and probability roll is drawn from dedicated forked streams
 *   labeled by the medication's RxCUI code.
 */
export function createMedicationsNode(
	prng: PRNG,
): DAGNode<readonly MedicationEntity[]> {
	return {
		id: "medications",
		dependsOn: ["archetype", "conditions"],
		resolve: (getResult) => {
			const archetype = getResult<ArchetypeDefinition>("archetype");
			const conditions = getResult<readonly ConditionEntity[]>("conditions");

			const conditionCodes = new Set(conditions.map((c) => c.code));
			const medications: MedicationEntity[] = [];

			for (const spec of archetype.medications) {
				if (
					spec.forCondition !== undefined &&
					!conditionCodes.has(spec.forCondition)
				) {
					continue;
				}

				const rollFork = prng.fork(`medication:${spec.rxcui}`);
				if (!rollProbability(rollFork, spec.probability)) {
					continue;
				}

				const idFork = prng.fork(`medication-id:${spec.rxcui}`);
				medications.push({
					id: generateSeededUUID(idFork),
					name: spec.name,
					rxcui: spec.rxcui,
					sig: spec.sig,
				});
			}

			return medications;
		},
	};
}
