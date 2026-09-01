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

// Real inpatient admissions span at least half a day, not minutes — a
// 15-minute "inpatient" stay would be an obvious plausibility red flag.
const INPATIENT_MIN_DURATION_MINUTES = 12 * 60;
const INPATIENT_MAX_DURATION_MINUTES = 4 * 24 * 60;
const OTHER_MIN_DURATION_MINUTES = 15;
const OTHER_MAX_DURATION_MINUTES = 4 * 60;

function buildPeriod(
	prng: PRNG,
	start: string,
	encounterClass: EncounterClass,
): { start: string; end?: string } {
	if (!prng.nextBool(0.7)) {
		return { start };
	}
	const durationMinutes =
		encounterClass === "inpatient"
			? prng.nextInt(
					INPATIENT_MIN_DURATION_MINUTES,
					INPATIENT_MAX_DURATION_MINUTES,
				)
			: prng.nextInt(OTHER_MIN_DURATION_MINUTES, OTHER_MAX_DURATION_MINUTES);
	return { start, end: addMinutes(start, durationMinutes) };
}

// Real NPIs are 10 digits where the 10th is a Luhn "double-add-double" check
// digit computed as though the 9-digit base were prefixed with "80840" (CMS's
// NPI check-digit specification) — verified against a worked example from
// cms.gov before implementing, rather than generating a plain random number
// that would fail Luhn validation ~90% of the time.
const NPI_LUHN_PREFIX = "80840";

function computeNpiCheckDigit(nineDigitBase: string): number {
	const payload = NPI_LUHN_PREFIX + nineDigitBase;
	let sum = 0;
	for (let position = 0; position < payload.length; position++) {
		const positionFromRight = payload.length - position;
		let digit = Number(payload[position]);
		if (positionFromRight % 2 === 1) {
			digit *= 2;
			if (digit > 9) digit -= 9;
		}
		sum += digit;
	}
	return (10 - (sum % 10)) % 10;
}

function generateProviderIdentifier(prng: PRNG): Identifier {
	const base = String(prng.nextInt(100_000_000, 999_999_999));
	const checkDigit = computeNpiCheckDigit(base);
	return {
		value: `${base}${checkDigit}`,
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
