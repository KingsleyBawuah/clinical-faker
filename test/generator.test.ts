import { describe, expect, test } from "bun:test";
import {
	InvalidReferenceDateError,
	InvalidSeedError,
} from "../src/core/errors.ts";
import { createPatient } from "../src/generator.ts";

describe("createPatient", () => {
	test("the same seed produces byte-identical output, including ids", () => {
		const a = createPatient({ seed: 42 });
		const b = createPatient({ seed: 42 });

		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	test("different seeds produce different patients", () => {
		const a = createPatient({ seed: 1 });
		const b = createPatient({ seed: 2 });

		expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
	});

	test("omitting seed generates a random one, recorded on the result", () => {
		const a = createPatient();
		const b = createPatient();

		expect(Number.isInteger(a.seed)).toBe(true);
		expect(a.seed).not.toBe(b.seed);
	});

	test("produces exactly one encounter for MVP", () => {
		const patient = createPatient({ seed: 7 });
		expect(patient.encounters).toHaveLength(1);
	});

	test("archetype-dependent entity lists are empty until Phase 4 archetypes exist", () => {
		const patient = createPatient({ seed: 7 });
		expect(patient.conditions).toEqual([]);
		expect(patient.observations).toEqual([]);
		expect(patient.medications).toEqual([]);
		expect(patient.allergies).toEqual([]);
	});

	test("respects an explicit referenceDate override", () => {
		const patient = createPatient({ seed: 7, referenceDate: "2020-05-05" });
		expect(patient.referenceDate).toBe("2020-05-05");
	});

	test("toJSON() adds a vitals projection on top of the same underlying data", () => {
		const patient = createPatient({ seed: 7 });
		const json = patient.toJSON();

		expect(json.demographics).toEqual(patient.demographics);
		expect(json.vitals).toEqual({});
	});

	test("JSON.stringify uses toJSON() automatically, per the JS serialization protocol", () => {
		const patient = createPatient({ seed: 7 });
		expect(JSON.stringify(patient)).toBe(JSON.stringify(patient.toJSON()));
	});

	test("toJSON() reflects the patient object's current state, not a stale snapshot", () => {
		const patient = createPatient({ seed: 7 });
		const replacement = [
			{
				loincCode: "8867-4",
				display: "Heart rate",
				value: 88,
				effectiveDateTime: "2024-01-01T00:00:00.000Z",
			},
		];

		patient.observations = replacement;

		expect(patient.toJSON().observations).toEqual(replacement);
		expect(patient.toJSON().vitals).toEqual({ heartRate: 88 });
	});

	test("seed: 0 works like any other seed", () => {
		const a = createPatient({ seed: 0 });
		const b = createPatient({ seed: 0 });
		expect(a.seed).toBe(0);
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	test("a non-integer or negative seed is normalized, and the reported seed matches the effective one", () => {
		const patient = createPatient({ seed: -5 });
		expect(patient.seed).toBe(-5 >>> 0);
		// Reproducing with the reported (normalized) seed gives the same patient.
		expect(JSON.stringify(createPatient({ seed: patient.seed }))).toBe(
			JSON.stringify(patient),
		);
	});

	test("throws InvalidSeedError for a non-finite seed", () => {
		expect(() => createPatient({ seed: Number.NaN })).toThrow(InvalidSeedError);
		expect(() => createPatient({ seed: Number.POSITIVE_INFINITY })).toThrow(
			InvalidSeedError,
		);
	});

	test("accepts a leap-day referenceDate", () => {
		const patient = createPatient({ seed: 1, referenceDate: "2024-02-29" });
		expect(patient.referenceDate).toBe("2024-02-29");
	});

	test("throws InvalidReferenceDateError for a malformed or calendar-invalid referenceDate", () => {
		expect(() =>
			createPatient({ seed: 1, referenceDate: "not-a-date" }),
		).toThrow(InvalidReferenceDateError);
		// 2023 is not a leap year, so Feb 29 doesn't exist that year.
		expect(() =>
			createPatient({ seed: 1, referenceDate: "2023-02-29" }),
		).toThrow(InvalidReferenceDateError);
	});
});
