import { describe, expect, test } from "bun:test";
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
});
