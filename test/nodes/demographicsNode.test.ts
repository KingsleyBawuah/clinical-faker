import { describe, expect, test } from "bun:test";
import { getNodeResult } from "../../src/core/dag/resolver.ts";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import type { Gender } from "../../src/entities/types.ts";
import { createDemographicsNode } from "../../src/nodes/demographicsNode.ts";
import type { SeedResult } from "../../src/nodes/seedNode.ts";

function stubSeedResult(seedResult: SeedResult) {
	const results = new Map<string, unknown>([["seed", seedResult]]);
	return <T>(nodeId: string): T => getNodeResult<T>(results, nodeId);
}

describe("createDemographicsNode", () => {
	test("has id 'demographics' and depends on 'seed'", () => {
		const node = createDemographicsNode(createMulberry32(1));
		expect(node.id).toBe("demographics");
		expect(node.dependsOn).toEqual(["seed"]);
	});

	test("regression: birthYear accounts for the birthday not having occurred yet this reference year", () => {
		// Seed 0 with referenceDate 2024-01-15 samples a June birthday, which
		// hasn't happened yet as of mid-January — so birthYear must be
		// referenceYear - age - 1 (2005), not the naive referenceYear - age
		// (2006) a version of this code once computed, which would make a
		// stated age of 18 inconsistent with a 2006 birth year.
		const node = createDemographicsNode(createMulberry32(0));
		const getResult = stubSeedResult({
			patientId: "unused",
			referenceDate: "2024-01-15",
		});

		const { dob, age } = node.resolve(getResult);

		expect(dob).toBe("2005-06-16");
		expect(age).toBe(18);
	});

	test("age always matches the true elapsed years between dob and referenceDate", () => {
		const referenceDate = "2024-06-15";
		const refYear = Number(referenceDate.slice(0, 4));
		const refMonth = Number(referenceDate.slice(5, 7));
		const refDay = Number(referenceDate.slice(8, 10));

		for (let seed = 0; seed < 300; seed++) {
			const node = createDemographicsNode(createMulberry32(seed));
			const getResult = stubSeedResult({ patientId: "unused", referenceDate });
			const { dob, age } = node.resolve(getResult);

			const dobYear = Number(dob.slice(0, 4));
			const dobMonth = Number(dob.slice(5, 7));
			const dobDay = Number(dob.slice(8, 10));
			const birthdayAlreadyOccurred =
				dobMonth < refMonth || (dobMonth === refMonth && dobDay <= refDay);
			const trueAge = birthdayAlreadyOccurred
				? refYear - dobYear
				: refYear - dobYear - 1;

			expect(age).toBe(trueAge);
		}
	});

	test("samples age within the realistic default adult range", () => {
		const getResult = stubSeedResult({
			patientId: "unused",
			referenceDate: "2024-01-01",
		});

		for (let seed = 0; seed < 100; seed++) {
			const node = createDemographicsNode(createMulberry32(seed));
			const { age } = node.resolve(getResult);
			expect(age).toBeGreaterThanOrEqual(18);
			expect(age).toBeLessThanOrEqual(90);
		}
	});

	test("produces a fully populated, plausible Demographics object", () => {
		const node = createDemographicsNode(createMulberry32(5));
		const getResult = stubSeedResult({
			patientId: "unused",
			referenceDate: "2024-01-01",
		});

		const demographics = node.resolve(getResult);
		const validGenders: readonly Gender[] = [
			"male",
			"female",
			"other",
			"unknown",
		];

		expect(demographics.firstName.length).toBeGreaterThan(0);
		expect(demographics.lastName.length).toBeGreaterThan(0);
		expect(validGenders).toContain(demographics.gender);
		expect(demographics.mrn.value.length).toBeGreaterThan(0);
		expect(demographics.mrn.assigningAuthority.length).toBeGreaterThan(0);
		expect(demographics.address.line.length).toBeGreaterThan(0);
	});

	test("is deterministic: same seed and referenceDate produce the same demographics", () => {
		const getResult = stubSeedResult({
			patientId: "unused",
			referenceDate: "2024-01-01",
		});
		const nodeA = createDemographicsNode(createMulberry32(42));
		const nodeB = createDemographicsNode(createMulberry32(42));

		expect(nodeA.resolve(getResult)).toEqual(nodeB.resolve(getResult));
	});
});
