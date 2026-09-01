import { describe, expect, test } from "bun:test";
import { getNodeResult } from "../../src/core/dag/resolver.ts";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import type { EncounterClass } from "../../src/entities/types.ts";
import { createEncounterNode } from "../../src/nodes/encounterNode.ts";
import type { SeedResult } from "../../src/nodes/seedNode.ts";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stubSeedResult(referenceDate: string) {
	const seedResult: SeedResult = { patientId: "unused", referenceDate };
	const results = new Map<string, unknown>([["seed", seedResult]]);
	return <T>(nodeId: string): T => getNodeResult<T>(results, nodeId);
}

// CMS's NPI check-digit spec: Luhn "double-add-double" over "80840" + the
// 10-digit NPI, which must sum to a multiple of 10.
function isValidNpiLuhn(npi: string): boolean {
	const digits = `80840${npi}`;
	let sum = 0;
	for (let position = 0; position < digits.length; position++) {
		const positionFromRight = digits.length - position;
		let digit = Number(digits[position]);
		if (positionFromRight % 2 === 0) {
			digit *= 2;
			if (digit > 9) digit -= 9;
		}
		sum += digit;
	}
	return sum % 10 === 0;
}

describe("createEncounterNode", () => {
	test("has id 'encounter' and depends on 'seed'", () => {
		const node = createEncounterNode(createMulberry32(1));
		expect(node.id).toBe("encounter");
		expect(node.dependsOn).toEqual(["seed"]);
	});

	test("produces a structurally valid Encounter for many seeds", () => {
		const getResult = stubSeedResult("2024-06-15");
		const validClasses: readonly EncounterClass[] = [
			"inpatient",
			"outpatient",
			"emergency",
		];

		for (let seed = 0; seed < 200; seed++) {
			const node = createEncounterNode(createMulberry32(seed));
			const encounter = node.resolve(getResult);

			expect(encounter.id).toMatch(UUID_PATTERN);
			expect(validClasses).toContain(encounter.class);
			expect(new Date(encounter.period.start).toString()).not.toBe(
				"Invalid Date",
			);
			if (encounter.period.end !== undefined) {
				expect(new Date(encounter.period.end).getTime()).toBeGreaterThan(
					new Date(encounter.period.start).getTime(),
				);
			}
			expect(encounter.attendingProvider.firstName.length).toBeGreaterThan(0);
			expect(encounter.attendingProvider.lastName.length).toBeGreaterThan(0);
			expect(encounter.attendingProvider.identifier.value).toMatch(/^\d{10}$/);
			expect(isValidNpiLuhn(encounter.attendingProvider.identifier.value)).toBe(
				true,
			);
			if (encounter.class === "inpatient" && encounter.period.end) {
				const durationMinutes =
					(new Date(encounter.period.end).getTime() -
						new Date(encounter.period.start).getTime()) /
					60_000;
				expect(durationMinutes).toBeGreaterThanOrEqual(12 * 60);
			}
		}
	});

	test("anchors the encounter's start to the seed node's referenceDate", () => {
		const getResult = stubSeedResult("2030-03-01");
		const node = createEncounterNode(createMulberry32(1));

		const encounter = node.resolve(getResult);

		expect(encounter.period.start.startsWith("2030-03-01")).toBe(true);
	});

	test("is deterministic: same seed and referenceDate produce the same encounter", () => {
		const getResult = stubSeedResult("2024-01-01");
		const nodeA = createEncounterNode(createMulberry32(42));
		const nodeB = createEncounterNode(createMulberry32(42));

		expect(nodeA.resolve(getResult)).toEqual(nodeB.resolve(getResult));
	});
});
