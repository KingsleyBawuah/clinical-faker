import { rollProbability } from "../archetypes/sampling.ts";
import type { ArchetypeDefinition } from "../archetypes/types.ts";
import type { DAGNode } from "../core/dag/types.ts";
import type { PRNG } from "../core/prng/types.ts";
import { generateSeededUUID } from "../core/prng/uuid.ts";
import type {
	ConditionEntity,
	ConditionRank,
	Demographics,
	Encounter,
} from "../entities/types.ts";

/**
 * Most chronic conditions have an onset history spanning at most 20 years before an encounter.
 */
export const MAX_ONSET_YEARS_BEFORE_ENCOUNTER = 20;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseISODateToUTCMs(isoDateOrDateTime: string): number {
	const year = Number(isoDateOrDateTime.slice(0, 4));
	const month = Number(isoDateOrDateTime.slice(5, 7));
	const day = Number(isoDateOrDateTime.slice(8, 10));
	return Date.UTC(year, month - 1, day);
}

function deriveEighteenthBirthdayMs(dob: string): number {
	const year = Number(dob.slice(0, 4));
	const month = Number(dob.slice(5, 7));
	const day = Number(dob.slice(8, 10));
	return Date.UTC(year + 18, month - 1, day);
}

function deriveMaxYearsBackMs(encounterDateStr: string): number {
	const year = Number(encounterDateStr.slice(0, 4));
	const month = Number(encounterDateStr.slice(5, 7));
	const day = Number(encounterDateStr.slice(8, 10));
	return Date.UTC(year - MAX_ONSET_YEARS_BEFORE_ENCOUNTER, month - 1, day);
}

/**
 * Produces the patient's conditions from the assigned archetype. Each condition spec
 * is sampled probabilistically on its own forked PRNG stream; its rank is derived from
 * probability (1.0 = primary, <1.0 = secondary); its id is a seeded UUID on a dedicated fork;
 * and its onsetDate is an ISO calendar date (YYYY-MM-DD) placed prior to the encounter
 * within plausible demographic limits (at most adult years / 18th birthday for adults,
 * between dob and encounter for pediatric patients, bounded by MAX_ONSET_YEARS_BEFORE_ENCOUNTER).
 */
export function createConditionsNode(
	prng: PRNG,
): DAGNode<readonly ConditionEntity[]> {
	return {
		id: "conditions",
		dependsOn: ["archetype", "demographics", "encounter"],
		resolve: (getResult) => {
			const archetype = getResult<ArchetypeDefinition>("archetype");
			const demographics = getResult<Demographics>("demographics");
			const encounter = getResult<Encounter>("encounter");

			const encounterDateMs = parseISODateToUTCMs(encounter.period.start);
			const dobMs = parseISODateToUTCMs(demographics.dob);
			const eighteenthBirthdayMs = deriveEighteenthBirthdayMs(demographics.dob);
			const maxYearsBackMs = deriveMaxYearsBackMs(encounter.period.start);

			const earliestAllowedMs = Math.max(
				demographics.age < 18 ? dobMs : eighteenthBirthdayMs,
				maxYearsBackMs,
			);
			const maxDaysBack = Math.max(
				0,
				Math.floor((encounterDateMs - earliestAllowedMs) / MS_PER_DAY),
			);

			const conditions: ConditionEntity[] = [];

			for (const spec of archetype.conditions) {
				const conditionFork = prng.fork(`condition:${spec.code}`);
				if (!rollProbability(conditionFork, spec.probability)) {
					continue;
				}

				const id = generateSeededUUID(prng.fork(`condition-id:${spec.code}`));
				const offsetDays = conditionFork.nextInt(0, maxDaysBack);
				const onsetMs = encounterDateMs - offsetDays * MS_PER_DAY;
				const onsetDate = new Date(onsetMs).toISOString().slice(0, 10);
				const rank: ConditionRank =
					spec.probability === 1.0 ? "primary" : "secondary";

				conditions.push({
					id,
					code: spec.code,
					display: spec.display,
					onsetDate,
					rank,
				});
			}

			return conditions;
		},
	};
}
