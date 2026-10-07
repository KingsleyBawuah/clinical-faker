import { getNodeResult, resolveDAG } from "./core/dag/resolver.ts";
import { InvalidReferenceDateError, InvalidSeedError } from "./core/errors.ts";
import { createMulberry32 } from "./core/prng/mulberry32.ts";
import { type PatientJSON, toJSON } from "./entities/exporters/toJSON.ts";
import type {
	Demographics,
	Encounter,
	PatientGraph,
} from "./entities/types.ts";
import type { HL7EventType, HL7ExportOptions } from "./hl7/exportOptions.ts";
import { toHL7 } from "./hl7/toHL7.ts";
import { createDemographicsNode } from "./nodes/demographicsNode.ts";
import { createEncounterNode } from "./nodes/encounterNode.ts";
import { createSeedNode, type SeedResult } from "./nodes/seedNode.ts";

export interface GenerationOptions {
	seed?: number;
	/** Overrides the deterministic seed-derived default. Rarely needed. */
	referenceDate?: string;
}

export interface Patient extends PatientGraph {
	toJSON(): PatientJSON;
	toHL7(eventType: HL7EventType, options?: HL7ExportOptions): string;
}

function generateRandomSeed(): number {
	return Math.floor(Math.random() * 0x100000000) >>> 0;
}

/**
 * Normalizes any finite number into the uint32 space every PRNG operation
 * already uses internally (see docs/architecture.md's "Seeded PRNG"), so
 * `patient.seed` always reports the actual effective seed rather than raw,
 * potentially non-integer or negative, caller input.
 */
function normalizeSeed(seed: number): number {
	if (!Number.isFinite(seed)) {
		throw new InvalidSeedError(seed);
	}
	return seed >>> 0;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertValidReferenceDate(referenceDate: string): void {
	if (!ISO_DATE_PATTERN.test(referenceDate)) {
		throw new InvalidReferenceDateError(referenceDate);
	}

	const year = Number(referenceDate.slice(0, 4));
	const month = Number(referenceDate.slice(5, 7));
	const day = Number(referenceDate.slice(8, 10));
	const date = new Date(Date.UTC(year, month - 1, day));

	// JS silently rolls calendar-invalid dates over (e.g. Feb 31 -> Mar 2)
	// instead of producing an Invalid Date, so a round-trip check is the
	// only way to actually catch a date like "2024-02-31".
	const roundTrips =
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day;
	if (!roundTrips) {
		throw new InvalidReferenceDateError(referenceDate);
	}
}

function buildPatientGraph(
	seed: number,
	options: GenerationOptions,
): PatientGraph {
	const rootPrng = createMulberry32(seed);

	const seedNode = createSeedNode(rootPrng.fork("seed"), options.referenceDate);
	const demographicsNode = createDemographicsNode(
		rootPrng.fork("demographics"),
	);
	const encounterNode = createEncounterNode(rootPrng.fork("encounter"));

	const results = resolveDAG([seedNode, demographicsNode, encounterNode]);

	const seedResult = getNodeResult<SeedResult>(results, "seed");
	const demographics = getNodeResult<Demographics>(results, "demographics");
	const encounter = getNodeResult<Encounter>(results, "encounter");

	return {
		id: seedResult.patientId,
		seed,
		referenceDate: seedResult.referenceDate,
		demographics,
		encounters: [encounter],
		conditions: [],
		observations: [],
		medications: [],
		allergies: [],
	};
}

/**
 * Generates a deterministic synthetic patient. The same `seed` always
 * produces the same patient — including the same ids — across every export
 * format. Omitting `seed` generates one randomly (returned on `.seed` so the
 * caller can capture it for later reproduction).
 */
export function createPatient(options: GenerationOptions = {}): Patient {
	const seed =
		options.seed !== undefined
			? normalizeSeed(options.seed)
			: generateRandomSeed();
	if (options.referenceDate !== undefined) {
		assertValidReferenceDate(options.referenceDate);
	}
	const graph = buildPatientGraph(seed, options);

	return {
		...graph,
		toJSON(): PatientJSON {
			return toJSON(this);
		},
		toHL7(eventType: HL7EventType, options?: HL7ExportOptions): string {
			return toHL7(this, eventType, options);
		},
	};
}
