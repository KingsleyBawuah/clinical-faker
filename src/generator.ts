import { ARCHETYPES, type ArchetypeName } from "./archetypes/registry.ts";
import { resolveArchetype } from "./archetypes/resolve.ts";
import type { ArchetypeDefinition } from "./archetypes/types.ts";
import { getNodeResult, resolveDAG } from "./core/dag/resolver.ts";
import { InvalidReferenceDateError, InvalidSeedError } from "./core/errors.ts";
import { createMulberry32 } from "./core/prng/mulberry32.ts";
import { type PatientJSON, toJSON } from "./entities/exporters/toJSON.ts";
import type {
	ConditionEntity,
	Demographics,
	Encounter,
	MedicationEntity,
	ObservationEntity,
	PatientGraph,
} from "./entities/types.ts";
import { toFHIR } from "./fhir/toFHIR.ts";
import type { Bundle, FHIRBundleType } from "./fhir/types.ts";
import type { HL7EventType, HL7ExportOptions } from "./hl7/exportOptions.ts";
import { toHL7 } from "./hl7/toHL7.ts";
import { createArchetypeNode } from "./nodes/archetypeNode.ts";
import { createConditionsNode } from "./nodes/conditionsNode.ts";
import { createDemographicsNode } from "./nodes/demographicsNode.ts";
import { createEncounterNode } from "./nodes/encounterNode.ts";
import { createMedicationsNode } from "./nodes/medicationsNode.ts";
import { createObservationsNode } from "./nodes/observationsNode.ts";
import { createSeedNode, type SeedResult } from "./nodes/seedNode.ts";

export interface GenerationOptions {
	seed?: number;
	/** Overrides the deterministic seed-derived default. Rarely needed. */
	referenceDate?: string;
	/** Omitted → one is picked from ARCHETYPES using the seed. */
	archetype?: ArchetypeName | ArchetypeDefinition;
}

export interface Patient extends PatientGraph {
	toJSON(): PatientJSON;
	toHL7(eventType: HL7EventType, options?: HL7ExportOptions): string;
	toFHIR(bundleType?: FHIRBundleType): Bundle;
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
	requestedDefinition?: ArchetypeDefinition,
): PatientGraph {
	const rootPrng = createMulberry32(seed);

	const seedNode = createSeedNode(rootPrng.fork("seed"), options.referenceDate);
	const demographicsNode = createDemographicsNode(
		rootPrng.fork("demographics"),
		requestedDefinition?.demographicConstraints,
	);
	const encounterNode = createEncounterNode(rootPrng.fork("encounter"));
	const archetypeNode = createArchetypeNode(
		rootPrng.fork("archetype"),
		ARCHETYPES,
		requestedDefinition,
	);
	const conditionsNode = createConditionsNode(rootPrng.fork("conditions"));
	const observationsNode = createObservationsNode(
		rootPrng.fork("observations"),
	);
	const medicationsNode = createMedicationsNode(rootPrng.fork("medications"));

	const results = resolveDAG([
		seedNode,
		demographicsNode,
		encounterNode,
		archetypeNode,
		conditionsNode,
		observationsNode,
		medicationsNode,
	]);

	const seedResult = getNodeResult<SeedResult>(results, "seed");
	const demographics = getNodeResult<Demographics>(results, "demographics");
	const encounter = getNodeResult<Encounter>(results, "encounter");
	const resolvedArchetype = getNodeResult<ArchetypeDefinition>(
		results,
		"archetype",
	);
	const conditions = getNodeResult<readonly ConditionEntity[]>(
		results,
		"conditions",
	);
	const observations = getNodeResult<readonly ObservationEntity[]>(
		results,
		"observations",
	);
	const medications = getNodeResult<readonly MedicationEntity[]>(
		results,
		"medications",
	);

	let archetypeName: string | undefined;
	for (const [key, definition] of Object.entries(ARCHETYPES).sort(([a], [b]) =>
		a.localeCompare(b),
	)) {
		if (definition === resolvedArchetype) {
			archetypeName = key;
			break;
		}
	}

	return {
		id: seedResult.patientId,
		seed,
		referenceDate: seedResult.referenceDate,
		demographics,
		...(archetypeName !== undefined ? { archetype: archetypeName } : {}),
		encounters: [encounter],
		conditions: [...conditions],
		observations: [...observations],
		medications: [...medications],
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
	const requestedDefinition =
		options.archetype !== undefined
			? resolveArchetype(options.archetype, ARCHETYPES)
			: undefined;
	const seed =
		options.seed !== undefined
			? normalizeSeed(options.seed)
			: generateRandomSeed();
	if (options.referenceDate !== undefined) {
		assertValidReferenceDate(options.referenceDate);
	}
	const graph = buildPatientGraph(seed, options, requestedDefinition);

	return {
		...graph,
		toJSON(): PatientJSON {
			return toJSON(this);
		},
		toHL7(eventType: HL7EventType, options?: HL7ExportOptions): string {
			return toHL7(this, eventType, options);
		},
		toFHIR(bundleType?: FHIRBundleType): Bundle {
			return toFHIR(this, bundleType);
		},
	};
}
