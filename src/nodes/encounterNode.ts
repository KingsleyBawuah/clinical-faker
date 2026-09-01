import type { DAGNode } from "../core/dag/types.ts";
import { pickFrom } from "../core/prng/pickFrom.ts";
import type { PRNG } from "../core/prng/types.ts";
import { generateSeededUUID } from "../core/prng/uuid.ts";
import {
	pickFirstName,
	pickGender,
	pickLastName,
} from "../entities/sampleData.ts";
import type {
	Encounter,
	EncounterClass,
	Identifier,
} from "../entities/types.ts";
import type { SeedResult } from "./seedNode.ts";

const ENCOUNTER_LOCATIONS = [
	"Emergency Department",
	"Ward 3A",
	"Ward 4B",
	"Outpatient Clinic A",
	"ICU",
	"Room 118",
	"Room 210",
] as const;

const MINUTES_PER_DAY = 24 * 60;

function pickEncounterClass(prng: PRNG): EncounterClass {
	const roll = prng.nextFloat(0, 1);
	if (roll < 0.7) return "outpatient";
	if (roll < 0.9) return "inpatient";
	return "emergency";
}

function pickLocation(prng: PRNG): string | undefined {
	if (!prng.nextBool(0.9)) return undefined;
	return pickFrom(prng, ENCOUNTER_LOCATIONS);
}

function addMinutes(iso: string, minutes: number): string {
	const date = new Date(iso);
	date.setUTCMinutes(date.getUTCMinutes() + minutes);
	return date.toISOString();
}

function buildPeriod(
	prng: PRNG,
	start: string,
	encounterClass: EncounterClass,
): { start: string; end?: string } {
	if (!prng.nextBool(0.7)) {
		return { start };
	}
	const maxDurationMinutes =
		encounterClass === "inpatient" ? 4 * 24 * 60 : 4 * 60;
	const durationMinutes = prng.nextInt(15, maxDurationMinutes);
	return { start, end: addMinutes(start, durationMinutes) };
}

function generateProviderIdentifier(prng: PRNG): Identifier {
	return {
		value: String(prng.nextInt(1_000_000_000, 9_999_999_999)),
		assigningAuthority: "NPI",
	};
}

/**
 * Depends only on `seed` (for `referenceDate`, which anchors the encounter's
 * timing). MVP always produces exactly one `Encounter` per patient; nothing
 * about its timing/location/provider depends on demographics or archetype
 * yet, so no dependency on those is declared until something actually needs
 * one — see docs/architecture.md's "DAG resolution engine".
 */
export function createEncounterNode(prng: PRNG): DAGNode<Encounter> {
	return {
		id: "encounter",
		dependsOn: ["seed"],
		resolve: (getResult) => {
			const seedResult = getResult<SeedResult>("seed");
			const encounterClass = pickEncounterClass(prng);
			const startOffsetMinutes = prng.nextInt(0, MINUTES_PER_DAY - 1);
			const start = addMinutes(
				`${seedResult.referenceDate}T00:00:00.000Z`,
				startOffsetMinutes,
			);
			const period = buildPeriod(prng, start, encounterClass);
			const location = pickLocation(prng);

			return {
				id: generateSeededUUID(prng),
				class: encounterClass,
				period,
				...(location === undefined ? {} : { location }),
				attendingProvider: {
					identifier: generateProviderIdentifier(prng),
					// A gender is sampled purely to pick a first-name pool — a
					// Provider has no gender field of its own.
					firstName: pickFirstName(prng, pickGender(prng)),
					lastName: pickLastName(prng),
				},
			};
		},
	};
}
