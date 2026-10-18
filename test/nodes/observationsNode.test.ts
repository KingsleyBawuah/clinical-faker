import { describe, expect, test } from "bun:test";
import { AdultHypertension } from "../../src/archetypes/adultHypertension.ts";
import { computeAbnormalFlag } from "../../src/archetypes/sampling.ts";
import type {
	ArchetypeDefinition,
	ObservationDistributionSpec,
} from "../../src/archetypes/types.ts";
import { getNodeResult, resolveDAG } from "../../src/core/dag/resolver.ts";
import type { DAGNode } from "../../src/core/dag/types.ts";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import type { Encounter, ObservationEntity } from "../../src/entities/types.ts";
import {
	DIASTOLIC_BP_LOINC,
	isVitalSignLoincCode,
	SPO2_LOINC,
	SYSTOLIC_BP_LOINC,
} from "../../src/entities/vitalsProjection.ts";
import {
	createObservationsNode,
	OPEN_ENCOUNTER_OBSERVATION_WINDOW_MINUTES,
} from "../../src/nodes/observationsNode.ts";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeEncounter(period: { start: string; end?: string }): Encounter {
	return {
		id: "enc-1",
		class: "outpatient",
		period,
		attendingProvider: {
			id: "prov-1",
			identifier: { value: "1234567893", assigningAuthority: "NPI" },
			firstName: "Jane",
			lastName: "Smith",
		},
	};
}

function stubGetResult(archetype: ArchetypeDefinition, encounter: Encounter) {
	const results = new Map<string, unknown>([
		["archetype", archetype],
		["encounter", encounter],
	]);
	return <T>(nodeId: string): T => getNodeResult<T>(results, nodeId);
}

describe("createObservationsNode", () => {
	test("declares id 'observations' and dependsOn ['archetype', 'encounter']", () => {
		const node = createObservationsNode(createMulberry32(1));
		expect(node.id).toBe("observations");
		expect(node.dependsOn).toEqual(["archetype", "encounter"]);
	});

	test("resolves cleanly in a DAG with stand-in archetype and encounter nodes", () => {
		const encounter = makeEncounter({
			start: "2024-05-01T10:00:00.000Z",
			end: "2024-05-01T11:00:00.000Z",
		});
		const archetypeNode: DAGNode<ArchetypeDefinition> = {
			id: "archetype",
			dependsOn: [],
			resolve: () => AdultHypertension,
		};
		const encounterNode: DAGNode<Encounter> = {
			id: "encounter",
			dependsOn: [],
			resolve: () => encounter,
		};
		const obsNode = createObservationsNode(createMulberry32(42));

		const dagResults = resolveDAG([archetypeNode, encounterNode, obsNode]);
		const observations = getNodeResult<readonly ObservationEntity[]>(
			dagResults,
			"observations",
		);

		expect(observations).toHaveLength(AdultHypertension.observations.length);
	});

	test("is fully deterministic for the same seed", () => {
		const encounter = makeEncounter({
			start: "2024-05-01T10:00:00.000Z",
			end: "2024-05-01T12:00:00.000Z",
		});
		const getResult = stubGetResult(AdultHypertension, encounter);

		const first = createObservationsNode(createMulberry32(12345)).resolve(
			getResult,
		);
		const second = createObservationsNode(createMulberry32(12345)).resolve(
			getResult,
		);

		expect(first).toEqual(second);
	});

	test("produces one ObservationEntity per spec with valid UUID id, copied unit and referenceRange", () => {
		const encounter = makeEncounter({
			start: "2024-05-01T10:00:00.000Z",
			end: "2024-05-01T11:30:00.000Z",
		});
		const getResult = stubGetResult(AdultHypertension, encounter);
		const observations = createObservationsNode(createMulberry32(7)).resolve(
			getResult,
		);

		expect(observations).toHaveLength(AdultHypertension.observations.length);

		for (const [i, spec] of AdultHypertension.observations.entries()) {
			const obs = observations[i];
			expect(obs).toBeDefined();
			if (!obs) continue;

			expect(obs.id).toMatch(UUID_PATTERN);
			expect(obs.loincCode).toBe(spec.loincCode);
			expect(obs.display).toBe(spec.display);
			expect(obs.unit).toBe(spec.unit);
			expect(obs.referenceRange).toEqual(spec.referenceRange);
		}
	});

	test("every observation value respects spec clamp and decimals", () => {
		const encounter = makeEncounter({
			start: "2024-05-01T08:00:00.000Z",
			end: "2024-05-01T09:00:00.000Z",
		});

		for (let seed = 0; seed < 50; seed++) {
			const getResult = stubGetResult(AdultHypertension, encounter);
			const observations = createObservationsNode(
				createMulberry32(seed),
			).resolve(getResult);

			for (const [i, spec] of AdultHypertension.observations.entries()) {
				const obs = observations[i];
				expect(obs).toBeDefined();
				if (!obs || typeof obs.value !== "number") continue;

				expect(obs.value).toBeGreaterThanOrEqual(spec.clamp.min);
				expect(obs.value).toBeLessThanOrEqual(spec.clamp.max);

				// Decimal places check
				const decimalStr = obs.value.toString().split(".")[1] ?? "";
				expect(decimalStr.length).toBeLessThanOrEqual(spec.decimals);
			}
		}
	});

	test("abnormalFlag strictly matches value compared against referenceRange", () => {
		const encounter = makeEncounter({
			start: "2024-05-01T08:00:00.000Z",
			end: "2024-05-01T09:00:00.000Z",
		});

		for (let seed = 0; seed < 50; seed++) {
			const getResult = stubGetResult(AdultHypertension, encounter);
			const observations = createObservationsNode(
				createMulberry32(seed),
			).resolve(getResult);

			for (const [i, spec] of AdultHypertension.observations.entries()) {
				const obs = observations[i];
				expect(obs).toBeDefined();
				if (!obs || typeof obs.value !== "number") continue;

				const expectedFlag = computeAbnormalFlag(
					obs.value,
					spec.referenceRange,
				);
				expect(obs.abnormalFlag).toBe(expectedFlag);
			}
		}
	});

	test("every effectiveDateTime falls within closed encounter period [start, end] across many seeds", () => {
		const startIso = "2024-05-01T10:00:00.000Z";
		const endIso = "2024-05-01T12:00:00.000Z";
		const startMs = Date.parse(startIso);
		const endMs = Date.parse(endIso);
		const encounter = makeEncounter({ start: startIso, end: endIso });

		for (let seed = 0; seed < 100; seed++) {
			const getResult = stubGetResult(AdultHypertension, encounter);
			const observations = createObservationsNode(
				createMulberry32(seed),
			).resolve(getResult);

			for (const obs of observations) {
				const obsMs = Date.parse(obs.effectiveDateTime);
				expect(Number.isNaN(obsMs)).toBe(false);
				expect(obsMs).toBeGreaterThanOrEqual(startMs);
				expect(obsMs).toBeLessThanOrEqual(endMs);
			}
		}
	});

	test("every effectiveDateTime falls within [start, start + OPEN_ENCOUNTER_OBSERVATION_WINDOW_MINUTES] for open encounters", () => {
		const startIso = "2024-05-01T10:00:00.000Z";
		const startMs = Date.parse(startIso);
		const maxEndMs =
			startMs + OPEN_ENCOUNTER_OBSERVATION_WINDOW_MINUTES * 60 * 1000;
		const encounter = makeEncounter({ start: startIso }); // no end

		for (let seed = 0; seed < 100; seed++) {
			const getResult = stubGetResult(AdultHypertension, encounter);
			const observations = createObservationsNode(
				createMulberry32(seed),
			).resolve(getResult);

			for (const obs of observations) {
				const obsMs = Date.parse(obs.effectiveDateTime);
				expect(Number.isNaN(obsMs)).toBe(false);
				expect(obsMs).toBeGreaterThanOrEqual(startMs);
				expect(obsMs).toBeLessThanOrEqual(maxEndMs);
			}
		}
	});

	test("a zero-duration encounter (period.start === period.end) produces observations at exactly that instant without throwing", () => {
		const instantIso = "2024-05-01T10:00:00.000Z";
		const encounter = makeEncounter({
			start: instantIso,
			end: instantIso,
		});

		for (let seed = 0; seed < 50; seed++) {
			const getResult = stubGetResult(AdultHypertension, encounter);
			const observations = createObservationsNode(
				createMulberry32(seed),
			).resolve(getResult);

			expect(observations).toHaveLength(AdultHypertension.observations.length);
			for (const obs of observations) {
				expect(obs.effectiveDateTime).toBe(instantIso);
			}
		}
	});

	test("an encounter anchored on a leap day that crosses midnight keeps every effectiveDateTime within the period", () => {
		const startIso = "2024-02-29T23:30:00.000Z";
		const endIso = "2024-03-01T00:30:00.000Z";
		const startMs = Date.parse(startIso);
		const endMs = Date.parse(endIso);
		const encounter = makeEncounter({ start: startIso, end: endIso });

		for (let seed = 0; seed < 100; seed++) {
			const getResult = stubGetResult(AdultHypertension, encounter);
			const observations = createObservationsNode(
				createMulberry32(seed),
			).resolve(getResult);

			expect(observations).toHaveLength(AdultHypertension.observations.length);
			for (const obs of observations) {
				const obsMs = Date.parse(obs.effectiveDateTime);
				expect(Number.isNaN(obsMs)).toBe(false);
				expect(obsMs).toBeGreaterThanOrEqual(startMs);
				expect(obsMs).toBeLessThanOrEqual(endMs);
			}
		}
	});

	test("all vital-sign observations share ONE seeded instant so systolic/diastolic BP always share it", () => {
		const encounter = makeEncounter({
			start: "2024-05-01T10:00:00.000Z",
			end: "2024-05-01T14:00:00.000Z",
		});

		for (let seed = 0; seed < 100; seed++) {
			const getResult = stubGetResult(AdultHypertension, encounter);
			const observations = createObservationsNode(
				createMulberry32(seed),
			).resolve(getResult);

			const vitals = observations.filter((o) =>
				isVitalSignLoincCode(o.loincCode),
			);
			expect(vitals.length).toBeGreaterThan(1);

			const firstInstant = vitals[0]?.effectiveDateTime;
			expect(firstInstant).toBeDefined();
			if (firstInstant === undefined) continue;

			for (const vital of vitals) {
				expect(vital.effectiveDateTime).toBe(firstInstant);
			}

			// Specifically assert systolic and diastolic match
			const systolic = observations.find(
				(o) => o.loincCode === SYSTOLIC_BP_LOINC,
			);
			const diastolic = observations.find(
				(o) => o.loincCode === DIASTOLIC_BP_LOINC,
			);
			expect(systolic).toBeDefined();
			expect(diastolic).toBeDefined();
			expect(systolic?.effectiveDateTime).toBe(diastolic?.effectiveDateTime);
		}
	});

	test("lab (non-vital) observations each receive their own seeded instant", () => {
		const encounter = makeEncounter({
			start: "2024-05-01T10:00:00.000Z",
			end: "2024-05-01T20:00:00.000Z",
		});

		let foundDistinctTimestamps = false;
		for (let seed = 0; seed < 20; seed++) {
			const getResult = stubGetResult(AdultHypertension, encounter);
			const observations = createObservationsNode(
				createMulberry32(seed),
			).resolve(getResult);

			const labs = observations.filter(
				(o) => !isVitalSignLoincCode(o.loincCode),
			);
			expect(labs.length).toBeGreaterThanOrEqual(2);

			const labInstants = labs.map((l) => l.effectiveDateTime);
			const uniqueInstants = new Set(labInstants);
			if (uniqueInstants.size === labs.length) {
				foundDistinctTimestamps = true;
				break;
			}
		}
		expect(foundDistinctTimestamps).toBe(true);
	});

	test("stability: adding an unrelated observation spec does not change others' values, ids, or timestamps", () => {
		const encounter = makeEncounter({
			start: "2024-05-01T10:00:00.000Z",
			end: "2024-05-01T12:00:00.000Z",
		});

		const baseArchetype: ArchetypeDefinition = {
			conditions: AdultHypertension.conditions,
			observations: AdultHypertension.observations,
			medications: AdultHypertension.medications,
		};

		const extraLabSpec: ObservationDistributionSpec = {
			loincCode: "2345-7",
			display: "Glucose [Mass/volume] in Blood",
			unit: "mg/dL",
			mean: 95,
			stdDev: 10,
			clamp: { min: 40, max: 400 },
			referenceRange: { low: 70, high: 99 },
			decimals: 0,
		};

		const extendedArchetype: ArchetypeDefinition = {
			...baseArchetype,
			observations: [...baseArchetype.observations, extraLabSpec],
		};

		const seed = 999;
		const baseObservations = createObservationsNode(
			createMulberry32(seed),
		).resolve(stubGetResult(baseArchetype, encounter));

		const extendedObservations = createObservationsNode(
			createMulberry32(seed),
		).resolve(stubGetResult(extendedArchetype, encounter));

		expect(extendedObservations).toHaveLength(baseObservations.length + 1);

		for (const [i, baseObs] of baseObservations.entries()) {
			const extObs = extendedObservations[i];
			expect(extObs).toEqual(baseObs);
		}
	});

	test("stability: adding an extra vital-sign spec does not change others' values, ids, or timestamps", () => {
		const encounter = makeEncounter({
			start: "2024-05-01T10:00:00.000Z",
			end: "2024-05-01T12:00:00.000Z",
		});

		const baseArchetype: ArchetypeDefinition = {
			conditions: AdultHypertension.conditions,
			observations: AdultHypertension.observations,
			medications: AdultHypertension.medications,
		};

		const extraVitalSpec: ObservationDistributionSpec = {
			loincCode: SPO2_LOINC,
			display: "Oxygen saturation in Arterial blood by Pulse oximetry",
			unit: "%",
			mean: 98,
			stdDev: 1.5,
			clamp: { min: 70, max: 100 },
			referenceRange: { low: 95, high: 100 },
			decimals: 0,
		};
		expect(isVitalSignLoincCode(extraVitalSpec.loincCode)).toBe(true);

		const extendedArchetype: ArchetypeDefinition = {
			...baseArchetype,
			observations: [...baseArchetype.observations, extraVitalSpec],
		};

		const seed = 999;
		const baseObservations = createObservationsNode(
			createMulberry32(seed),
		).resolve(stubGetResult(baseArchetype, encounter));

		const extendedObservations = createObservationsNode(
			createMulberry32(seed),
		).resolve(stubGetResult(extendedArchetype, encounter));

		expect(extendedObservations).toHaveLength(baseObservations.length + 1);

		for (const [i, baseObs] of baseObservations.entries()) {
			const extObs = extendedObservations[i];
			expect(extObs).toEqual(baseObs);
		}

		const newVital = extendedObservations[extendedObservations.length - 1];
		expect(newVital).toBeDefined();
		const systolic = baseObservations.find(
			(o) => o.loincCode === SYSTOLIC_BP_LOINC,
		);
		expect(newVital?.effectiveDateTime).toBe(systolic?.effectiveDateTime);
	});

	test("handles archetype with empty observations list", () => {
		const encounter = makeEncounter({
			start: "2024-05-01T10:00:00.000Z",
			end: "2024-05-01T12:00:00.000Z",
		});
		const emptyArchetype: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [],
		};

		const observations = createObservationsNode(createMulberry32(1)).resolve(
			stubGetResult(emptyArchetype, encounter),
		);

		expect(observations).toEqual([]);
	});
});
