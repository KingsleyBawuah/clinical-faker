import { getNodeResult, resolveDAG } from "./core/dag/resolver.ts";
import { createMulberry32 } from "./core/prng/mulberry32.ts";
import { type PatientJSON, toJSON } from "./entities/exporters/toJSON.ts";
import type {
	Demographics,
	Encounter,
	PatientGraph,
} from "./entities/types.ts";
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
}

function generateRandomSeed(): number {
	return Math.floor(Math.random() * 0x100000000) >>> 0;
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
	const seed = options.seed ?? generateRandomSeed();
	const graph = buildPatientGraph(seed, options);

	return {
		...graph,
		toJSON: () => toJSON(graph),
	};
}
