import {
	computeAbnormalFlag,
	sampleObservationValue,
} from "../archetypes/sampling.ts";
import type { ArchetypeDefinition } from "../archetypes/types.ts";
import type { DAGNode } from "../core/dag/types.ts";
import type { PRNG } from "../core/prng/types.ts";
import { generateSeededUUID } from "../core/prng/uuid.ts";
import type { Encounter, ObservationEntity } from "../entities/types.ts";
import { isVitalSignLoincCode } from "../entities/vitalsProjection.ts";

/**
 * When an encounter has no `period.end` (open encounter), observations are
 * placed within this window following `period.start`.
 */
export const OPEN_ENCOUNTER_OBSERVATION_WINDOW_MINUTES = 60;

/**
 * Produces one `ObservationEntity` per `ObservationDistributionSpec` from the
 * resolved archetype:
 * - Value sampled via Gaussian draw bounded by clamp and rounded to spec decimals.
 * - `unit` and `referenceRange` copied from the spec.
 * - `abnormalFlag` derived directly from value vs referenceRange.
 * - `effectiveDateTime` falls within the encounter period [start, end] (or
 *   [start, start + OPEN_ENCOUNTER_OBSERVATION_WINDOW_MINUTES] if period.end is
 *   absent).
 * - All vital-sign observations share ONE seeded instant so systolic/diastolic
 *   pair into an 85354-9 BP panel in FHIR.
 * - Each lab observation receives its own seeded instant within the period.
 * - Every entity id and value stream is forked with the spec's LOINC code.
 */
export function createObservationsNode(
	prng: PRNG,
): DAGNode<readonly ObservationEntity[]> {
	return {
		id: "observations",
		dependsOn: ["archetype", "encounter"],
		resolve: (getResult) => {
			const archetype = getResult<ArchetypeDefinition>("archetype");
			const encounter = getResult<Encounter>("encounter");

			const startMs = Date.parse(encounter.period.start);
			const endMs =
				encounter.period.end !== undefined
					? Date.parse(encounter.period.end)
					: startMs + OPEN_ENCOUNTER_OBSERVATION_WINDOW_MINUTES * 60 * 1000;
			const durationMs = Math.max(0, endMs - startMs);

			function sampleInstant(stream: PRNG): string {
				const offsetMs = durationMs === 0 ? 0 : stream.nextInt(0, durationMs);
				return new Date(startMs + offsetMs).toISOString();
			}

			// All vital-sign observations share one seeded instant
			const vitalsInstant = sampleInstant(
				prng.fork("observation-timestamp:vitals"),
			);

			return archetype.observations.map((spec): ObservationEntity => {
				const valuePrng = prng.fork(`observation:${spec.loincCode}`);
				const idPrng = prng.fork(`observation-id:${spec.loincCode}`);
				const isVital = isVitalSignLoincCode(spec.loincCode);
				const effectiveDateTime = isVital
					? vitalsInstant
					: sampleInstant(prng.fork(`observation-timestamp:${spec.loincCode}`));

				const value = sampleObservationValue(valuePrng, spec);
				const abnormalFlag = computeAbnormalFlag(value, spec.referenceRange);

				return {
					id: generateSeededUUID(idPrng),
					loincCode: spec.loincCode,
					display: spec.display,
					value,
					unit: spec.unit,
					effectiveDateTime,
					referenceRange: {
						low: spec.referenceRange.low,
						high: spec.referenceRange.high,
					},
					abnormalFlag,
				};
			});
		},
	};
}
