import { describe, expect, test } from "bun:test";
import { NoEncounterForClinicalDataError } from "../../src/core/errors.ts";
import type {
	AllergyEntity,
	ConditionEntity,
	Encounter,
	MedicationEntity,
	ObservationEntity,
	PatientGraph,
} from "../../src/entities/types.ts";
import { toFHIR } from "../../src/fhir/toFHIR.ts";
import type { Bundle } from "../../src/fhir/types.ts";
import { createPatient } from "../../src/generator.ts";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Every `Reference.reference` string anywhere inside `value`. */
function collectReferences(value: object): string[] {
	return [...JSON.stringify(value).matchAll(/"reference":"([^"]*)"/g)].map(
		([, reference]) => reference ?? "",
	);
}

function secondEncounterSharingProvider(graph: PatientGraph): Encounter {
	const [first] = graph.encounters;
	if (first === undefined) throw new Error("unreachable");
	return { ...first, id: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e" };
}

// Synthetic values only; a systolic/diastolic pair exercises BP panel pairing.
const AT = "2024-03-01T09:00:00.000Z";
const CONDITION: ConditionEntity = {
	id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
	code: "I10",
	display: "Essential (primary) hypertension",
	rank: "primary",
};
const SYSTOLIC: ObservationEntity = {
	id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
	loincCode: "8480-6",
	display: "Systolic blood pressure",
	value: 142,
	unit: "mm[Hg]",
	effectiveDateTime: AT,
};
const DIASTOLIC: ObservationEntity = {
	id: "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f",
	loincCode: "8462-4",
	display: "Diastolic blood pressure",
	value: 91,
	unit: "mm[Hg]",
	effectiveDateTime: AT,
};
const MEDICATION: MedicationEntity = {
	id: "4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f8a",
	name: "lisinopril 10 MG Oral Tablet",
	rxcui: "314076",
	sig: "Take 1 tablet by mouth daily",
};
const ALLERGY: AllergyEntity = {
	id: "5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8a9b",
	substance: "Penicillin",
};

function withClinicalData(graph: PatientGraph): PatientGraph {
	return {
		...graph,
		conditions: [CONDITION],
		observations: [SYSTOLIC, DIASTOLIC],
		medications: [MEDICATION],
		allergies: [ALLERGY],
	};
}

describe("toFHIR", () => {
	const graph = createPatient({
		seed: 42,
		archetype: { conditions: [], observations: [], medications: [] },
	}).toJSON();

	test("defaults to a collection bundle of Patient, Practitioner, then Encounter", () => {
		const bundle = toFHIR(graph);

		expect(bundle.resourceType).toBe("Bundle");
		expect(bundle.type).toBe("collection");
		expect(bundle.id).toMatch(UUID_PATTERN);
		expect(bundle.entry.map((entry) => entry.resource.resourceType)).toEqual([
			"Patient",
			"Practitioner",
			"Encounter",
		]);
	});

	test("each entry's fullUrl is urn:uuid:<the resource's own id>", () => {
		for (const entry of toFHIR(graph).entry) {
			expect(entry.fullUrl).toBe(`urn:uuid:${entry.resource.id}`);
		}
	});

	test("collection entries carry no request", () => {
		for (const entry of toFHIR(graph, "collection").entry) {
			expect("request" in entry).toBe(false);
		}
	});

	test("transaction entries POST to their resource type", () => {
		const bundle = toFHIR(graph, "transaction");
		if (bundle.type !== "transaction") throw new Error("expected transaction");

		for (const entry of bundle.entry) {
			expect(entry.request).toEqual({
				method: "POST",
				url: entry.resource.resourceType,
			});
		}
	});

	for (const bundleType of ["collection", "transaction"] as const) {
		test(`${bundleType}: every Reference resolves to an entry's fullUrl`, () => {
			const bundle: Bundle = toFHIR(withClinicalData(graph), bundleType);
			const fullUrls = new Set(bundle.entry.map((entry) => entry.fullUrl));
			const references = collectReferences(bundle.entry);

			expect(references.length).toBeGreaterThan(0);
			for (const reference of references) {
				expect(fullUrls.has(reference)).toBe(true);
			}
		});
	}

	test("emits a provider shared by two encounters once", () => {
		const bundle = toFHIR({
			...graph,
			encounters: [...graph.encounters, secondEncounterSharingProvider(graph)],
		});

		expect(bundle.entry.map((entry) => entry.resource.resourceType)).toEqual([
			"Patient",
			"Practitioner",
			"Encounter",
			"Encounter",
		]);
	});

	test("the same seed and bundle type produce a deep-equal bundle", () => {
		const other = createPatient({
			seed: 42,
			archetype: { conditions: [], observations: [], medications: [] },
		}).toJSON();

		expect(toFHIR(graph, "transaction")).toEqual(toFHIR(other, "transaction"));
	});

	test("collection and transaction bundles get different ids", () => {
		expect(toFHIR(graph, "collection").id).not.toBe(
			toFHIR(graph, "transaction").id,
		);
	});

	test("Bundle.id doesn't collide with any resource id", () => {
		const bundle = toFHIR(graph);
		const resourceIds = bundle.entry.map((entry) => entry.resource.id);

		expect(resourceIds).not.toContain(bundle.id);
	});

	test("appends conditions, observations, medications, then allergies", () => {
		const [first] = graph.encounters;
		if (first === undefined) throw new Error("unreachable");
		const bundle = toFHIR(withClinicalData(graph));

		expect(
			bundle.entry.map(({ resource }) => [resource.resourceType, resource.id]),
		).toEqual([
			["Patient", graph.id],
			["Practitioner", first.attendingProvider.id],
			["Encounter", first.id],
			["Condition", CONDITION.id],
			// The BP pair is one panel keeping the first reading's id.
			["Observation", SYSTOLIC.id],
			["MedicationRequest", MEDICATION.id],
			["AllergyIntolerance", ALLERGY.id],
		]);
	});

	test("attaches encounter-bound resources to the first encounter", () => {
		const [first] = graph.encounters;
		if (first === undefined) throw new Error("unreachable");
		const bundle = toFHIR(
			withClinicalData({
				...graph,
				encounters: [
					...graph.encounters,
					secondEncounterSharingProvider(graph),
				],
			}),
		);
		const encounterReferences = bundle.entry.flatMap(({ resource }) =>
			"encounter" in resource ? [resource.encounter.reference] : [],
		);

		expect(encounterReferences).toEqual([
			`urn:uuid:${first.id}`,
			`urn:uuid:${first.id}`,
			`urn:uuid:${first.id}`,
		]);
	});

	test("a patient with no encounters and only allergies still compiles", () => {
		const bundle = toFHIR({
			...graph,
			encounters: [],
			allergies: [ALLERGY],
		});

		expect(bundle.entry.map(({ resource }) => resource.resourceType)).toEqual([
			"Patient",
			"AllergyIntolerance",
		]);
	});

	test("throws when encounter-bound data exists but no encounter does", () => {
		expect(() =>
			toFHIR({ ...withClinicalData(graph), encounters: [] }),
		).toThrow(NoEncounterForClinicalDataError);
	});
});
