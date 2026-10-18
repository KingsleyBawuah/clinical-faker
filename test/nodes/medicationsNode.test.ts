import { describe, expect, test } from "bun:test";
import { AdultHypertension } from "../../src/archetypes/adultHypertension.ts";
import type {
	ArchetypeDefinition,
	MedicationSpec,
} from "../../src/archetypes/types.ts";
import { getNodeResult, resolveDAG } from "../../src/core/dag/resolver.ts";
import type { DAGNode } from "../../src/core/dag/types.ts";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import type {
	ConditionEntity,
	MedicationEntity,
} from "../../src/entities/types.ts";
import { createMedicationsNode } from "../../src/nodes/medicationsNode.ts";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeCondition(code: string, display: string): ConditionEntity {
	return {
		id: `cond-${code}`,
		code,
		display,
		rank: "primary",
	};
}

function stubGetResult(
	archetype: ArchetypeDefinition,
	conditions: readonly ConditionEntity[],
) {
	const results = new Map<string, unknown>([
		["archetype", archetype],
		["conditions", conditions],
	]);
	return <T>(nodeId: string): T => getNodeResult<T>(results, nodeId);
}

describe("createMedicationsNode", () => {
	test("declares id 'medications' and dependsOn ['archetype', 'conditions']", () => {
		const node = createMedicationsNode(createMulberry32(1));
		expect(node.id).toBe("medications");
		expect(node.dependsOn).toEqual(["archetype", "conditions"]);
	});

	test("resolves cleanly in a DAG with stand-in archetype and conditions nodes", () => {
		const conditions: readonly ConditionEntity[] = [
			makeCondition("I10", "Essential (primary) hypertension"),
		];
		const archetypeNode: DAGNode<ArchetypeDefinition> = {
			id: "archetype",
			dependsOn: [],
			resolve: () => AdultHypertension,
		};
		const conditionsNode: DAGNode<readonly ConditionEntity[]> = {
			id: "conditions",
			dependsOn: [],
			resolve: () => conditions,
		};
		const medNode = createMedicationsNode(createMulberry32(42));

		const dagResults = resolveDAG([archetypeNode, conditionsNode, medNode]);
		const medications = getNodeResult<readonly MedicationEntity[]>(
			dagResults,
			"medications",
		);

		expect(Array.isArray(medications)).toBe(true);
	});

	test("is fully deterministic for the same seed", () => {
		const conditions: readonly ConditionEntity[] = [
			makeCondition("I10", "Essential (primary) hypertension"),
			makeCondition("E78.5", "Hyperlipidemia, unspecified"),
		];
		const getResult = stubGetResult(AdultHypertension, conditions);

		const first = createMedicationsNode(createMulberry32(54321)).resolve(
			getResult,
		);
		const second = createMedicationsNode(createMulberry32(54321)).resolve(
			getResult,
		);

		expect(first).toEqual(second);
	});

	test("produces MedicationEntity with valid UUID id and copied name, rxcui, sig", () => {
		const testArchetype: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [
				{
					name: "Lisinopril 10mg",
					rxcui: "314076",
					sig: "Daily",
					probability: 1.0,
				},
			],
		};
		const getResult = stubGetResult(testArchetype, []);
		const medications = createMedicationsNode(createMulberry32(99)).resolve(
			getResult,
		);

		expect(medications).toHaveLength(1);
		const med = medications[0];
		expect(med).toBeDefined();
		if (!med) return;

		expect(med.id).toMatch(UUID_PATTERN);
		expect(med.name).toBe("Lisinopril 10mg");
		expect(med.rxcui).toBe("314076");
		expect(med.sig).toBe("Daily");
	});

	test("gating by forCondition: when forCondition is set and condition is absent, medication is never included", () => {
		const testArchetype: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [
				{
					name: "Atorvastatin 20mg",
					rxcui: "259255",
					sig: "Daily at bedtime",
					probability: 1.0, // 100% probability, but condition absent
					forCondition: "E78.5",
				},
			],
		};

		// No conditions present
		const getResultNoConditions = stubGetResult(testArchetype, []);
		for (let seed = 0; seed < 50; seed++) {
			const meds = createMedicationsNode(createMulberry32(seed)).resolve(
				getResultNoConditions,
			);
			expect(meds).toHaveLength(0);
		}

		// Different condition present (I10 instead of E78.5)
		const getResultWrongCondition = stubGetResult(testArchetype, [
			makeCondition("I10", "Essential (primary) hypertension"),
		]);
		for (let seed = 0; seed < 50; seed++) {
			const meds = createMedicationsNode(createMulberry32(seed)).resolve(
				getResultWrongCondition,
			);
			expect(meds).toHaveLength(0);
		}
	});

	test("gating by forCondition: when forCondition is set and condition is present, medication is eligible", () => {
		const testArchetype: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [
				{
					name: "Atorvastatin 20mg",
					rxcui: "259255",
					sig: "Daily at bedtime",
					probability: 1.0,
					forCondition: "E78.5",
				},
			],
		};

		const getResultWithCondition = stubGetResult(testArchetype, [
			makeCondition("E78.5", "Hyperlipidemia, unspecified"),
		]);

		for (let seed = 0; seed < 50; seed++) {
			const meds = createMedicationsNode(createMulberry32(seed)).resolve(
				getResultWithCondition,
			);
			expect(meds).toHaveLength(1);
			expect(meds[0]?.rxcui).toBe("259255");
		}
	});

	test("when forCondition is omitted, medication is always eligible", () => {
		const testArchetype: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [
				{
					name: "Multivitamin",
					rxcui: "123456",
					sig: "Daily",
					probability: 1.0,
					// no forCondition
				},
			],
		};

		const getResultNoConditions = stubGetResult(testArchetype, []);
		const meds = createMedicationsNode(createMulberry32(1)).resolve(
			getResultNoConditions,
		);
		expect(meds).toHaveLength(1);
		expect(meds[0]?.rxcui).toBe("123456");
	});

	test("probability 1.0 is always included and probability 0.0 is never included", () => {
		const testArchetype: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [
				{
					name: "Always Med",
					rxcui: "111111",
					sig: "Daily",
					probability: 1.0,
				},
				{
					name: "Never Med",
					rxcui: "222222",
					sig: "Daily",
					probability: 0.0,
				},
			],
		};

		const getResult = stubGetResult(testArchetype, []);
		for (let seed = 0; seed < 50; seed++) {
			const meds = createMedicationsNode(createMulberry32(seed)).resolve(
				getResult,
			);
			expect(meds.map((m) => m.rxcui)).toEqual(["111111"]);
		}
	});

	test("stability: adding an unrelated medication spec does not change others' values or ids", () => {
		const conditions: readonly ConditionEntity[] = [
			makeCondition("I10", "Essential (primary) hypertension"),
		];

		const baseArchetype: ArchetypeDefinition = {
			conditions: AdultHypertension.conditions,
			observations: AdultHypertension.observations,
			medications: [
				{
					name: "Med A",
					rxcui: "1001",
					sig: "Daily",
					probability: 0.8,
					forCondition: "I10",
				},
				{
					name: "Med B",
					rxcui: "1002",
					sig: "Twice daily",
					probability: 0.6,
				},
			],
		};

		const extraMedSpec: MedicationSpec = {
			name: "Med C",
			rxcui: "1003",
			sig: "Once weekly",
			probability: 0.5,
		};

		const extendedArchetype: ArchetypeDefinition = {
			...baseArchetype,
			medications: [...baseArchetype.medications, extraMedSpec],
		};

		for (let seed = 0; seed < 50; seed++) {
			const baseMeds = createMedicationsNode(createMulberry32(seed)).resolve(
				stubGetResult(baseArchetype, conditions),
			);
			const extendedMeds = createMedicationsNode(
				createMulberry32(seed),
			).resolve(stubGetResult(extendedArchetype, conditions));

			// Med A and Med B in extended should match base exactly (presence, id, fields)
			const baseRxcuis = new Set(baseMeds.map((m) => m.rxcui));
			const extendedFiltered = extendedMeds.filter((m) =>
				baseRxcuis.has(m.rxcui),
			);

			expect(extendedFiltered).toEqual([...baseMeds]);
		}
	});

	test("stability: skipping a medication for missing condition does not affect other medications' streams", () => {
		// Archetype has Med 1 (requires E78.5) and Med 2 (requires I10)
		const archetype: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [
				{
					name: "Lipid Med",
					rxcui: "259255",
					sig: "Daily",
					probability: 0.7,
					forCondition: "E78.5",
				},
				{
					name: "BP Med",
					rxcui: "314076",
					sig: "Daily",
					probability: 0.7,
					forCondition: "I10",
				},
			],
		};

		// Scenario 1: only I10 is present (Lipid Med skipped)
		// Scenario 2: both E78.5 and I10 are present
		// For any seed where BP Med is included, its id and presence must be identical between Scenario 1 and 2!
		for (let seed = 0; seed < 50; seed++) {
			const resScenario1 = createMedicationsNode(
				createMulberry32(seed),
			).resolve(
				stubGetResult(archetype, [makeCondition("I10", "Hypertension")]),
			);
			const resScenario2 = createMedicationsNode(
				createMulberry32(seed),
			).resolve(
				stubGetResult(archetype, [
					makeCondition("E78.5", "Hyperlipidemia"),
					makeCondition("I10", "Hypertension"),
				]),
			);

			const bpMed1 = resScenario1.find((m) => m.rxcui === "314076");
			const bpMed2 = resScenario2.find((m) => m.rxcui === "314076");

			expect(bpMed1).toEqual(bpMed2);
		}
	});

	test("handles archetype with empty medications list", () => {
		const emptyArchetype: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [],
		};

		const meds = createMedicationsNode(createMulberry32(1)).resolve(
			stubGetResult(emptyArchetype, []),
		);

		expect(meds).toEqual([]);
	});
});
