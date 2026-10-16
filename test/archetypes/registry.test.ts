import { describe, expect, test } from "bun:test";
import { AdultHypertension } from "../../src/archetypes/adultHypertension.ts";
import { ARCHETYPES } from "../../src/archetypes/registry.ts";
import { resolveArchetype } from "../../src/archetypes/resolve.ts";
import { MAX_DECIMALS } from "../../src/archetypes/sampling.ts";
import {
	DIASTOLIC_BP_LOINC,
	SYSTOLIC_BP_LOINC,
} from "../../src/entities/vitalsProjection.ts";

// Format checks only — whether a code is real is verified against NLM
// sources by hand (see the comment block in each archetype's module).
const ICD10CM_FORMAT = /^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/;
const LOINC_FORMAT = /^[1-9][0-9]{0,6}-[0-9]$/;
const RXCUI_FORMAT = /^[1-9][0-9]*$/;

function duplicates(values: readonly string[]): string[] {
	return values.filter((value, index) => values.indexOf(value) !== index);
}

describe("ARCHETYPES", () => {
	test("registers AdultHypertension under its own name", () => {
		expect(ARCHETYPES.AdultHypertension).toBe(AdultHypertension);
		expect(resolveArchetype("AdultHypertension", ARCHETYPES)).toBe(
			AdultHypertension,
		);
	});

	describe.each(Object.entries(ARCHETYPES))(
		"%s data invariants",
		(_name, archetype) => {
			const allProbabilities = [
				...archetype.conditions.map((c) => c.probability),
				...archetype.medications.map((m) => m.probability),
			];

			test("every probability is in [0, 1]", () => {
				for (const probability of allProbabilities) {
					expect(probability).toBeGreaterThanOrEqual(0);
					expect(probability).toBeLessThanOrEqual(1);
				}
			});

			test("exactly one condition is primary (probability 1.0)", () => {
				const primary = archetype.conditions.filter((c) => c.probability === 1);
				expect(primary).toHaveLength(1);
			});

			test.each(archetype.observations.map((o) => [o.loincCode, o] as const))(
				"observation %s has clamp.min < low <= high < clamp.max, mean within clamp, stdDev > 0",
				(_code, observation) => {
					const { clamp, referenceRange, mean, stdDev } = observation;
					expect(clamp.min).toBeLessThan(referenceRange.low);
					expect(referenceRange.low).toBeLessThanOrEqual(referenceRange.high);
					expect(referenceRange.high).toBeLessThan(clamp.max);
					expect(mean).toBeGreaterThanOrEqual(clamp.min);
					expect(mean).toBeLessThanOrEqual(clamp.max);
					expect(stdDev).toBeGreaterThan(0);
				},
			);

			test.each(archetype.observations.map((o) => [o.loincCode, o] as const))(
				`observation %s rounds to an integer number of decimals in [0, ${MAX_DECIMALS}]`,
				(_code, observation) => {
					expect(Number.isInteger(observation.decimals)).toBe(true);
					expect(observation.decimals).toBeGreaterThanOrEqual(0);
					expect(observation.decimals).toBeLessThanOrEqual(MAX_DECIMALS);
				},
			);

			test("every forCondition refers to a condition in the same archetype", () => {
				const conditionCodes = new Set(archetype.conditions.map((c) => c.code));
				for (const medication of archetype.medications) {
					if (medication.forCondition === undefined) continue;
					expect(conditionCodes.has(medication.forCondition)).toBe(true);
				}
			});

			test("codes are well-formed ICD-10-CM / LOINC / RxCUI", () => {
				for (const condition of archetype.conditions) {
					expect(condition.code).toMatch(ICD10CM_FORMAT);
				}
				for (const observation of archetype.observations) {
					expect(observation.loincCode).toMatch(LOINC_FORMAT);
				}
				for (const medication of archetype.medications) {
					expect(medication.rxcui).toMatch(RXCUI_FORMAT);
				}
			});

			test("every display, unit, name, and sig is non-empty", () => {
				const strings = [
					...archetype.conditions.map((c) => c.display),
					...archetype.observations.flatMap((o) => [o.display, o.unit]),
					...archetype.medications.flatMap((m) => [m.name, m.sig]),
				];
				for (const value of strings) {
					expect(value.trim()).not.toBe("");
				}
			});

			test("no duplicate codes", () => {
				expect(duplicates(archetype.conditions.map((c) => c.code))).toEqual([]);
				expect(
					duplicates(archetype.observations.map((o) => o.loincCode)),
				).toEqual([]);
				expect(duplicates(archetype.medications.map((m) => m.rxcui))).toEqual(
					[],
				);
			});
		},
	);
});

describe("AdultHypertension", () => {
	test("its primary condition is I10 essential hypertension", () => {
		const primary = AdultHypertension.conditions.find(
			(c) => c.probability === 1,
		);
		expect(primary).toEqual({
			code: "I10",
			display: "Essential (primary) hypertension",
			probability: 1,
		});
	});

	test("samples systolic and diastolic BP with means above the normal range", () => {
		for (const loincCode of [SYSTOLIC_BP_LOINC, DIASTOLIC_BP_LOINC]) {
			const observation = AdultHypertension.observations.find(
				(o) => o.loincCode === loincCode,
			);
			expect(observation?.unit).toBe("mm[Hg]");
			if (observation === undefined) return;
			expect(observation.mean).toBeGreaterThan(observation.referenceRange.high);
		}
	});

	test("prescribes at least two antihypertensives for I10", () => {
		const forI10 = AdultHypertension.medications.filter(
			(m) => m.forCondition === "I10",
		);
		expect(forI10.length).toBeGreaterThanOrEqual(2);
	});
});
