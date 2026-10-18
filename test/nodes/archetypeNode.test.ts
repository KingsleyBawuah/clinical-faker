import { describe, expect, test } from "bun:test";
import type { ArchetypeDefinition } from "../../src/archetypes/types.ts";
import { resolveDAG } from "../../src/core/dag/resolver.ts";
import type { DAGNode } from "../../src/core/dag/types.ts";
import { NoCompatibleArchetypeError } from "../../src/core/errors.ts";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import type { Demographics } from "../../src/entities/types.ts";
import { createArchetypeNode } from "../../src/nodes/archetypeNode.ts";

function stubDemographicsNode(
	demographics: Partial<Demographics>,
): DAGNode<Demographics> {
	return {
		id: "demographics",
		dependsOn: [],
		resolve: () => ({
			firstName: "Jane",
			lastName: "Doe",
			dob: "1990-01-01",
			age: 34,
			gender: "female",
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

const baseArchetype: ArchetypeDefinition = {
	conditions: [],
	observations: [],
	medications: [],
};

const femaleOnlyArchetype: ArchetypeDefinition = {
	...baseArchetype,
	demographicConstraints: {
		compatibleGenders: ["female"],
	},
};

const maleOnlyArchetype: ArchetypeDefinition = {
	...baseArchetype,
	demographicConstraints: {
		compatibleGenders: ["male"],
	},
};

const pediatricArchetype: ArchetypeDefinition = {
	...baseArchetype,
	demographicConstraints: {
		minAge: 0,
		maxAge: 17,
	},
};

const adultArchetype: ArchetypeDefinition = {
	...baseArchetype,
	demographicConstraints: {
		minAge: 18,
		maxAge: 64,
	},
};

const geriatricArchetype: ArchetypeDefinition = {
	...baseArchetype,
	demographicConstraints: {
		minAge: 65,
	},
};

describe("createArchetypeNode", () => {
	test("has id 'archetype' and depends on ['demographics']", () => {
		const node = createArchetypeNode(createMulberry32(1), {});
		expect(node.id).toBe("archetype");
		expect(node.dependsOn).toEqual(["demographics"]);
	});

	test("passes through requested archetype unchanged", () => {
		const requested: ArchetypeDefinition = {
			...baseArchetype,
			conditions: [
				{
					code: "I10",
					display: "Essential hypertension",
					probability: 1.0,
				},
			],
		};

		const node = createArchetypeNode(createMulberry32(1), {}, requested);
		const dagResult = resolveDAG([
			stubDemographicsNode({ age: 80, gender: "male" }),
			node,
		]);

		expect(dagResult.get("archetype")).toBe(requested);
	});

	test("auto-pick determinism: same seed produces the same archetype", () => {
		const registry: Record<string, ArchetypeDefinition> = {
			ArchetypeA: {
				...baseArchetype,
				conditions: [{ code: "A01", display: "Condition A", probability: 1.0 }],
			},
			ArchetypeB: {
				...baseArchetype,
				conditions: [{ code: "B01", display: "Condition B", probability: 1.0 }],
			},
			ArchetypeC: {
				...baseArchetype,
				conditions: [{ code: "C01", display: "Condition C", probability: 1.0 }],
			},
		};

		for (const seed of [0, 1, 42, 1234, 99999]) {
			const resA = resolveDAG([
				stubDemographicsNode({ age: 30, gender: "female" }),
				createArchetypeNode(createMulberry32(seed), registry),
			]).get("archetype");

			const resB = resolveDAG([
				stubDemographicsNode({ age: 30, gender: "female" }),
				createArchetypeNode(createMulberry32(seed), registry),
			]).get("archetype");

			expect(resA).toBe(resB);
		}
	});

	test("constraint filtering with a two-entry test registry (one constrained out)", () => {
		const registry: Record<string, ArchetypeDefinition> = {
			FemaleOption: femaleOnlyArchetype,
			MaleOption: maleOnlyArchetype,
		};

		for (let seed = 0; seed < 30; seed++) {
			const resFemale = resolveDAG([
				stubDemographicsNode({ age: 30, gender: "female" }),
				createArchetypeNode(createMulberry32(seed), registry),
			]).get("archetype");

			expect(resFemale).toBe(femaleOnlyArchetype);

			const resMale = resolveDAG([
				stubDemographicsNode({ age: 30, gender: "male" }),
				createArchetypeNode(createMulberry32(seed), registry),
			]).get("archetype");

			expect(resMale).toBe(maleOnlyArchetype);
		}
	});

	test("filters candidate archetypes by age constraints (minAge/maxAge inclusive)", () => {
		const registry: Record<string, ArchetypeDefinition> = {
			Pediatric: pediatricArchetype,
			Adult: adultArchetype,
			Geriatric: geriatricArchetype,
		};

		// Age 17 -> Pediatric (minAge 0, maxAge 17 inclusive)
		const res17 = resolveDAG([
			stubDemographicsNode({ age: 17, gender: "female" }),
			createArchetypeNode(createMulberry32(1), registry),
		]).get("archetype");
		expect(res17).toBe(pediatricArchetype);

		// Age 18 -> Adult (minAge 18, maxAge 64 inclusive)
		const res18 = resolveDAG([
			stubDemographicsNode({ age: 18, gender: "female" }),
			createArchetypeNode(createMulberry32(1), registry),
		]).get("archetype");
		expect(res18).toBe(adultArchetype);

		// Age 64 -> Adult
		const res64 = resolveDAG([
			stubDemographicsNode({ age: 64, gender: "female" }),
			createArchetypeNode(createMulberry32(1), registry),
		]).get("archetype");
		expect(res64).toBe(adultArchetype);

		// Age 65 -> Geriatric (minAge 65)
		const res65 = resolveDAG([
			stubDemographicsNode({ age: 65, gender: "female" }),
			createArchetypeNode(createMulberry32(1), registry),
		]).get("archetype");
		expect(res65).toBe(geriatricArchetype);
	});

	test("unconstrained archetypes accept any demographics", () => {
		const unconstrained: ArchetypeDefinition = {
			...baseArchetype,
			conditions: [{ code: "U01", display: "Unconstrained", probability: 1.0 }],
		};
		const registry: Record<string, ArchetypeDefinition> = {
			Unconstrained: unconstrained,
		};

		const res = resolveDAG([
			stubDemographicsNode({ age: 95, gender: "other" }),
			createArchetypeNode(createMulberry32(1), registry),
		]).get("archetype");
		expect(res).toBe(unconstrained);
	});

	test("sorted-key determinism: same registry with different key insertion order yields the same pick", () => {
		const defA: ArchetypeDefinition = {
			...baseArchetype,
			conditions: [{ code: "A", display: "A", probability: 1.0 }],
		};
		const defB: ArchetypeDefinition = {
			...baseArchetype,
			conditions: [{ code: "B", display: "B", probability: 1.0 }],
		};
		const defC: ArchetypeDefinition = {
			...baseArchetype,
			conditions: [{ code: "C", display: "C", probability: 1.0 }],
		};

		const registryOrder1: Record<string, ArchetypeDefinition> = {
			Zulu: defA,
			Alpha: defB,
			Mike: defC,
		};

		const registryOrder2: Record<string, ArchetypeDefinition> = {
			Alpha: defB,
			Mike: defC,
			Zulu: defA,
		};

		for (let seed = 0; seed < 50; seed++) {
			const res1 = resolveDAG([
				stubDemographicsNode({ age: 30, gender: "female" }),
				createArchetypeNode(createMulberry32(seed), registryOrder1),
			]).get("archetype");

			const res2 = resolveDAG([
				stubDemographicsNode({ age: 30, gender: "female" }),
				createArchetypeNode(createMulberry32(seed), registryOrder2),
			]).get("archetype");

			expect(res1).toBe(res2);
		}
	});

	test("throws NoCompatibleArchetypeError when no candidate fits demographics", () => {
		const registry: Record<string, ArchetypeDefinition> = {
			MaleOnly: maleOnlyArchetype,
		};

		expect(() =>
			resolveDAG([
				stubDemographicsNode({ age: 34, gender: "female" }),
				createArchetypeNode(createMulberry32(1), registry),
			]),
		).toThrow(NoCompatibleArchetypeError);

		try {
			resolveDAG([
				stubDemographicsNode({ age: 34, gender: "female" }),
				createArchetypeNode(createMulberry32(1), registry),
			]);
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(NoCompatibleArchetypeError);
			if (error instanceof NoCompatibleArchetypeError) {
				expect(error.age).toBe(34);
				expect(error.gender).toBe("female");
				expect(error.message).toContain("34");
				expect(error.message).toContain("female");
			}
		}
	});

	test("throws NoCompatibleArchetypeError when registry is empty", () => {
		expect(() =>
			resolveDAG([
				stubDemographicsNode({ age: 25, gender: "male" }),
				createArchetypeNode(createMulberry32(1), {}),
			]),
		).toThrow(NoCompatibleArchetypeError);
	});
});
