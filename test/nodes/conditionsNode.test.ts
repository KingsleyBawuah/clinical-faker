import { describe, expect, test } from "bun:test";
import type { ArchetypeDefinition } from "../../src/archetypes/types.ts";
import { getNodeResult, resolveDAG } from "../../src/core/dag/resolver.ts";
import type { DAGNode } from "../../src/core/dag/types.ts";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import type {
	ConditionEntity,
	Demographics,
	Encounter,
} from "../../src/entities/types.ts";
import {
	createConditionsNode,
	MAX_ONSET_YEARS_BEFORE_ENCOUNTER,
	parseISODateParts,
} from "../../src/nodes/conditionsNode.ts";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stubArchetypeNode(
	archetype: ArchetypeDefinition,
): DAGNode<ArchetypeDefinition> {
	return {
		id: "archetype",
		dependsOn: [],
		resolve: () => archetype,
	};
}

function stubDemographicsNode(
	demographics: Partial<Demographics>,
): DAGNode<Demographics> {
	return {
		id: "demographics",
		dependsOn: [],
		resolve: () => ({
			firstName: "John",
			lastName: "Doe",
			dob: "1980-05-15",
			age: 44,
			gender: "male",
			phone: "+18042221111",
			mrn: { value: "MRN123456", assigningAuthority: "clinical-faker" },
			address: {
				line: "123 Main St",
				city: "Anytown",
				state: "MO",
				postalCode: "12345",
				country: "USA",
			},
			...demographics,
		}),
	};
}

function stubEncounterNode(encounter?: Partial<Encounter>): DAGNode<Encounter> {
	return {
		id: "encounter",
		dependsOn: [],
		resolve: () => ({
			id: "enc-uuid-1",
			class: "outpatient",
			period: { start: "2024-06-15T09:00:00.000Z" },
			attendingProvider: {
				id: "prov-uuid-1",
				identifier: { value: "1234567890", assigningAuthority: "NPI" },
				firstName: "Doc",
				lastName: "Smith",
			},
			...encounter,
		}),
	};
}

describe("createConditionsNode", () => {
	test("has id 'conditions' and depends on ['archetype', 'demographics', 'encounter']", () => {
		const node = createConditionsNode(createMulberry32(1));
		expect(node.id).toBe("conditions");
		expect(node.dependsOn).toEqual(["archetype", "demographics", "encounter"]);
	});

	test("condition inclusion at probability 1 and 0", () => {
		const archetype: ArchetypeDefinition = {
			conditions: [
				{ code: "I10", display: "Always included", probability: 1.0 },
				{ code: "E78.5", display: "Never included", probability: 0.0 },
			],
			observations: [],
			medications: [],
		};

		for (let seed = 0; seed < 50; seed++) {
			const dagResult = resolveDAG([
				stubArchetypeNode(archetype),
				stubDemographicsNode({ age: 40 }),
				stubEncounterNode(),
				createConditionsNode(createMulberry32(seed)),
			]);

			const conditions = getNodeResult<readonly ConditionEntity[]>(
				dagResult,
				"conditions",
			);
			expect(conditions).toHaveLength(1);
			expect(conditions[0]?.code).toBe("I10");
			expect(conditions[0]?.display).toBe("Always included");
		}
	});

	test("rank derivation: 1.0 is primary, <1.0 is secondary", () => {
		const archetype: ArchetypeDefinition = {
			conditions: [
				{ code: "I10", display: "Primary condition", probability: 1.0 },
				{ code: "E78.5", display: "Comorbidity", probability: 0.999 },
			],
			observations: [],
			medications: [],
		};

		// Across seeds, whenever E78.5 is included it must have rank 'secondary', and I10 must have 'primary'
		let sawSecondary = false;
		for (let seed = 0; seed < 50; seed++) {
			const dagResult = resolveDAG([
				stubArchetypeNode(archetype),
				stubDemographicsNode({ age: 40 }),
				stubEncounterNode(),
				createConditionsNode(createMulberry32(seed)),
			]);

			const conditions = getNodeResult<readonly ConditionEntity[]>(
				dagResult,
				"conditions",
			);
			const primary = conditions.find((c) => c.code === "I10");
			expect(primary).toBeDefined();
			expect(primary?.rank).toBe("primary");

			const secondary = conditions.find((c) => c.code === "E78.5");
			if (secondary !== undefined) {
				sawSecondary = true;
				expect(secondary.rank).toBe("secondary");
			}
		}
		expect(sawSecondary).toBe(true);
	});

	test("assigns deterministic seeded UUIDs to generated conditions", () => {
		const archetype: ArchetypeDefinition = {
			conditions: [
				{ code: "I10", display: "Primary condition", probability: 1.0 },
			],
			observations: [],
			medications: [],
		};

		const seenIds = new Set<string>();

		for (let seed = 0; seed < 50; seed++) {
			const dagResult = resolveDAG([
				stubArchetypeNode(archetype),
				stubDemographicsNode({ age: 40 }),
				stubEncounterNode(),
				createConditionsNode(createMulberry32(seed)),
			]);

			const conditions = getNodeResult<readonly ConditionEntity[]>(
				dagResult,
				"conditions",
			);
			const id = conditions[0]?.id;
			expect(id).toMatch(UUID_PATTERN);
			if (id !== undefined) {
				seenIds.add(id);
			}
		}

		expect(seenIds.size).toBeGreaterThan(1);
		expect(seenIds.size).toBe(50);
	});

	test("onsetDate always <= encounter start date, >= dob, and >= 18th birthday for adults", () => {
		const archetype: ArchetypeDefinition = {
			conditions: [
				{ code: "I10", display: "Primary condition", probability: 1.0 },
			],
			observations: [],
			medications: [],
		};

		// Test across diverse adult ages and dates
		const testCases = [
			{ dob: "1980-05-15", age: 44, encStart: "2024-06-15T09:00:00.000Z" },
			{ dob: "2006-06-15", age: 18, encStart: "2024-06-15T14:30:00.000Z" },
			{ dob: "2005-01-01", age: 19, encStart: "2024-01-01T08:00:00.000Z" },
			{ dob: "1950-11-20", age: 73, encStart: "2024-03-10T11:00:00.000Z" },
			{ dob: "2000-02-29", age: 24, encStart: "2024-02-29T10:00:00.000Z" }, // leap year
		];

		for (const { dob, age, encStart } of testCases) {
			const encDateOnly = encStart.slice(0, 10);
			const {
				year: dobYear,
				month: dobMonth,
				day: dobDay,
			} = parseISODateParts(dob);
			const eighteenthBirthday = new Date(
				Date.UTC(dobYear + 18, dobMonth - 1, dobDay),
			)
				.toISOString()
				.slice(0, 10);

			const {
				year: encYear,
				month: encMonth,
				day: encDay,
			} = parseISODateParts(encDateOnly);
			const maxYearsBackDate = new Date(
				Date.UTC(
					encYear - MAX_ONSET_YEARS_BEFORE_ENCOUNTER,
					encMonth - 1,
					encDay,
				),
			)
				.toISOString()
				.slice(0, 10);

			const distinctOnsets = new Set<string>();

			for (let seed = 0; seed < 50; seed++) {
				const dagResult = resolveDAG([
					stubArchetypeNode(archetype),
					stubDemographicsNode({ dob, age }),
					stubEncounterNode({ period: { start: encStart } }),
					createConditionsNode(createMulberry32(seed)),
				]);

				const conditions = getNodeResult<readonly ConditionEntity[]>(
					dagResult,
					"conditions",
				);
				const onset = conditions[0]?.onsetDate;
				expect(onset).toBeDefined();
				if (onset !== undefined) {
					expect(onset <= encDateOnly).toBe(true);
					expect(onset >= dob).toBe(true);
					expect(onset >= eighteenthBirthday).toBe(true);
					expect(onset >= maxYearsBackDate).toBe(true);
					distinctOnsets.add(onset);
				}
			}

			// When patient has adult history before encounter (maxDaysBack > 0),
			// verify that onset strictly prior to the encounter date occurs and that
			// multiple distinct onset dates are produced across seeds.
			const encounterDateMs = Date.UTC(encYear, encMonth - 1, encDay);
			const eighteenthBirthdayMs = Date.UTC(dobYear + 18, dobMonth - 1, dobDay);
			const maxYearsBackMs = Date.UTC(
				encYear - MAX_ONSET_YEARS_BEFORE_ENCOUNTER,
				encMonth - 1,
				encDay,
			);
			const earliestAllowedMs = Math.max(eighteenthBirthdayMs, maxYearsBackMs);
			const maxDaysBack = Math.max(
				0,
				Math.floor(
					(encounterDateMs - earliestAllowedMs) / (24 * 60 * 60 * 1000),
				),
			);

			if (maxDaysBack > 0) {
				expect(distinctOnsets.size).toBeGreaterThan(1);
				expect(Array.from(distinctOnsets).some((d) => d < encDateOnly)).toBe(
					true,
				);
			} else {
				expect(distinctOnsets.size).toBe(1);
				expect(distinctOnsets.has(encDateOnly)).toBe(true);
			}
		}
	});

	test("onsetDate for patient under 18: between dob and encounter start date", () => {
		const archetype: ArchetypeDefinition = {
			conditions: [
				{ code: "J45.909", display: "Asthma, unspecified", probability: 1.0 },
			],
			observations: [],
			medications: [],
		};

		const dob = "2014-06-15";
		const age = 10;
		const encStart = "2024-06-15T10:00:00.000Z";
		const encDateOnly = encStart.slice(0, 10);
		const distinctOnsets = new Set<string>();

		for (let seed = 0; seed < 100; seed++) {
			const dagResult = resolveDAG([
				stubArchetypeNode(archetype),
				stubDemographicsNode({ dob, age }),
				stubEncounterNode({ period: { start: encStart } }),
				createConditionsNode(createMulberry32(seed)),
			]);

			const conditions = getNodeResult<readonly ConditionEntity[]>(
				dagResult,
				"conditions",
			);
			const onset = conditions[0]?.onsetDate;
			expect(onset).toBeDefined();
			if (onset !== undefined) {
				expect(onset >= dob).toBe(true);
				expect(onset <= encDateOnly).toBe(true);
				distinctOnsets.add(onset);
			}
		}

		expect(distinctOnsets.size).toBeGreaterThan(1);
		expect(Array.from(distinctOnsets).some((d) => d < encDateOnly)).toBe(true);
	});

	test("stability: adding an unrelated condition to a spec does not change existing conditions' ids or onsets", () => {
		const singleConditionArchetype: ArchetypeDefinition = {
			conditions: [
				{ code: "I10", display: "Essential hypertension", probability: 1.0 },
			],
			observations: [],
			medications: [],
		};

		const dualConditionArchetype: ArchetypeDefinition = {
			conditions: [
				{ code: "I10", display: "Essential hypertension", probability: 1.0 },
				{ code: "E78.5", display: "Hyperlipidemia", probability: 1.0 },
			],
			observations: [],
			medications: [],
		};

		const reversedConditionArchetype: ArchetypeDefinition = {
			conditions: [
				{ code: "E78.5", display: "Hyperlipidemia", probability: 1.0 },
				{ code: "I10", display: "Essential hypertension", probability: 1.0 },
			],
			observations: [],
			medications: [],
		};

		for (let seed = 0; seed < 50; seed++) {
			const res1 = getNodeResult<readonly ConditionEntity[]>(
				resolveDAG([
					stubArchetypeNode(singleConditionArchetype),
					stubDemographicsNode({ age: 50 }),
					stubEncounterNode(),
					createConditionsNode(createMulberry32(seed)),
				]),
				"conditions",
			);

			const res2 = getNodeResult<readonly ConditionEntity[]>(
				resolveDAG([
					stubArchetypeNode(dualConditionArchetype),
					stubDemographicsNode({ age: 50 }),
					stubEncounterNode(),
					createConditionsNode(createMulberry32(seed)),
				]),
				"conditions",
			);

			const res3 = getNodeResult<readonly ConditionEntity[]>(
				resolveDAG([
					stubArchetypeNode(reversedConditionArchetype),
					stubDemographicsNode({ age: 50 }),
					stubEncounterNode(),
					createConditionsNode(createMulberry32(seed)),
				]),
				"conditions",
			);

			const c1 = res1.find((c) => c.code === "I10");
			const c2 = res2.find((c) => c.code === "I10");
			const c3 = res3.find((c) => c.code === "I10");

			expect(c1).toBeDefined();
			expect(c2).toBeDefined();
			expect(c3).toBeDefined();

			expect(c1?.id).toBe(c2?.id);
			expect(c1?.id).toBe(c3?.id);
			expect(c1?.onsetDate).toBe(c2?.onsetDate);
			expect(c1?.onsetDate).toBe(c3?.onsetDate);
			expect(c1?.rank).toBe(c2?.rank);
		}
	});

	test("is deterministic: same seed produces identical output", () => {
		const archetype: ArchetypeDefinition = {
			conditions: [
				{ code: "I10", display: "Primary", probability: 1.0 },
				{ code: "E78.5", display: "Secondary", probability: 0.5 },
			],
			observations: [],
			medications: [],
		};

		for (const seed of [1, 42, 999, 12345]) {
			const resA = getNodeResult<readonly ConditionEntity[]>(
				resolveDAG([
					stubArchetypeNode(archetype),
					stubDemographicsNode({ age: 55 }),
					stubEncounterNode(),
					createConditionsNode(createMulberry32(seed)),
				]),
				"conditions",
			);

			const resB = getNodeResult<readonly ConditionEntity[]>(
				resolveDAG([
					stubArchetypeNode(archetype),
					stubDemographicsNode({ age: 55 }),
					stubEncounterNode(),
					createConditionsNode(createMulberry32(seed)),
				]),
				"conditions",
			);

			expect(resA).toEqual(resB);
		}
	});
});
