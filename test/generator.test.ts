import { describe, expect, test } from "bun:test";
import {
	InvalidArchetypeError,
	InvalidReferenceDateError,
	InvalidSeedError,
	UnknownArchetypeError,
	UnsatisfiableDemographicConstraintsError,
} from "../src/core/errors.ts";
import { createPatient } from "../src/generator.ts";
import type { ArchetypeDefinition, ArchetypeName } from "../src/index.ts";

describe("createPatient", () => {
	test("the same seed produces byte-identical output, including ids", () => {
		const a = createPatient({ seed: 42 });
		const b = createPatient({ seed: 42 });

		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	// Expected values recorded from seed 42 before the provider id existed:
	// adding a seeded field must not shift any previously generated value. The
	// provider id itself is pinned too, so a change to it is caught here.
	test("seed 42's encounter keeps its pre-provider-id values", () => {
		const encounter = createPatient({ seed: 42 }).encounters[0];

		expect(encounter).toEqual({
			id: "f8f2d03e-205b-4efe-8ecd-4ee1f81d2f8b",
			class: "outpatient",
			period: { start: "2024-10-17T11:16:00.000Z" },
			location: "Ward 3A",
			attendingProvider: {
				id: "a844d112-f640-45a0-ae4e-882ba8a5e21e",
				identifier: { value: "3912859014", assigningAuthority: "NPI" },
				firstName: "Elizabeth",
				lastName: "Garcia",
			},
		});
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

	test("omitted archetype defaults to AdultHypertension with non-empty conditions incl. I10, observations, and medications", () => {
		const patient = createPatient({ seed: 7 });
		expect(patient.archetype).toBe("AdultHypertension");
		expect(patient.conditions.length).toBeGreaterThan(0);
		expect(patient.conditions.some((c) => c.code === "I10")).toBe(true);
		expect(patient.observations.length).toBeGreaterThan(0);
		expect(patient.medications.length).toBeGreaterThan(0);
		expect(patient.allergies).toEqual([]);
	});

	test("archetype: 'AdultHypertension' produces identical output to omitted archetype", () => {
		const explicit = createPatient({
			seed: 42,
			archetype: "AdultHypertension",
		});
		const implicit = createPatient({ seed: 42 });
		expect(JSON.stringify(explicit)).toBe(JSON.stringify(implicit));
		expect(explicit.archetype).toBe("AdultHypertension");
	});

	test("accepts a custom ArchetypeDefinition and sets archetype to undefined", () => {
		const custom: ArchetypeDefinition = {
			conditions: [
				{
					code: "E11.9",
					display: "Type 2 diabetes mellitus without complications",
					probability: 1.0,
				},
			],
			observations: [
				{
					loincCode: "2345-7",
					display: "Glucose [Mass/volume] in Serum or Plasma",
					unit: "mg/dL",
					mean: 140,
					stdDev: 15,
					clamp: { min: 40, max: 500 },
					referenceRange: { low: 70, high: 99 },
					decimals: 0,
				},
			],
			medications: [
				{
					name: "metformin 500 MG Oral Tablet",
					rxcui: "860975",
					sig: "Take 1 tablet by mouth twice daily",
					probability: 1.0,
					forCondition: "E11.9",
				},
			],
		};
		const patient = createPatient({ seed: 42, archetype: custom });
		expect(patient.archetype).toBeUndefined();
		expect(patient.conditions).toHaveLength(1);
		expect(patient.conditions[0]?.code).toBe("E11.9");
		expect(patient.observations).toHaveLength(1);
		expect(patient.observations[0]?.loincCode).toBe("2345-7");
		expect(patient.medications).toHaveLength(1);
		expect(patient.medications[0]?.rxcui).toBe("860975");
	});

	test("custom definition with demographicConstraints is respected over many seeds", () => {
		const custom: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [],
			demographicConstraints: {
				minAge: 65,
				maxAge: 75,
				compatibleGenders: ["female"],
			},
		};
		for (let seed = 1; seed <= 50; seed++) {
			const patient = createPatient({ seed, archetype: custom });
			expect(patient.demographics.age).toBeGreaterThanOrEqual(65);
			expect(patient.demographics.age).toBeLessThanOrEqual(75);
			expect(patient.demographics.gender).toBe("female");
		}
	});

	test("unsatisfiable demographicConstraints throws UnsatisfiableDemographicConstraintsError", () => {
		const unsatisfiableAge: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [],
			demographicConstraints: { minAge: 95 },
		};
		expect(() => createPatient({ archetype: unsatisfiableAge })).toThrow(
			UnsatisfiableDemographicConstraintsError,
		);

		const unsatisfiableRange: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [],
			demographicConstraints: { minAge: 10, maxAge: 15 },
		};
		expect(() => createPatient({ archetype: unsatisfiableRange })).toThrow(
			UnsatisfiableDemographicConstraintsError,
		);

		const emptyGenders: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [],
			demographicConstraints: { compatibleGenders: [] },
		};
		expect(() => createPatient({ archetype: emptyGenders })).toThrow(
			UnsatisfiableDemographicConstraintsError,
		);
	});

	test("misspelled archetype name throws UnknownArchetypeError", () => {
		expect(() =>
			createPatient({
				// type-coverage:ignore-next-line
				archetype: "AdultHypotension" as unknown as ArchetypeName,
			}),
		).toThrow(UnknownArchetypeError);
	});

	test("null archetype throws InvalidArchetypeError", () => {
		expect(() =>
			createPatient({
				// type-coverage:ignore-next-line
				archetype: null as unknown as ArchetypeName,
			}),
		).toThrow(InvalidArchetypeError);
	});

	test("every observation's effectiveDateTime lies within the encounter period", () => {
		for (const seed of [1, 2, 7, 42, 100]) {
			const patient = createPatient({ seed });
			const [encounter] = patient.encounters;
			expect(encounter).toBeDefined();
			if (encounter === undefined) throw new Error("unreachable");

			const startMs = Date.parse(encounter.period.start);
			const endMs =
				encounter.period.end !== undefined
					? Date.parse(encounter.period.end)
					: startMs + 60 * 60 * 1000;

			for (const obs of patient.observations) {
				const obsMs = Date.parse(obs.effectiveDateTime);
				expect(obsMs).toBeGreaterThanOrEqual(startMs);
				expect(obsMs).toBeLessThanOrEqual(endMs);
			}
		}
	});

	test("medications only appear for generated conditions", () => {
		for (let seed = 1; seed <= 50; seed++) {
			const patient = createPatient({ seed });
			const conditionCodes = new Set(patient.conditions.map((c) => c.code));
			for (const med of patient.medications) {
				if (med.rxcui === "617310") {
					expect(conditionCodes.has("E78.5")).toBe(true);
				} else {
					expect(conditionCodes.has("I10")).toBe(true);
				}
			}
		}
	});

	test("demographics regression pins: fixed seeds produce byte-identical demographics to pre-archetype baseline", () => {
		expect(createPatient({ seed: 1 }).demographics).toEqual({
			firstName: "James",
			lastName: "Hernandez",
			dob: "1976-02-02",
			age: 49,
			gender: "male",
			mrn: { value: "MRN279518", assigningAuthority: "clinical-faker" },
			address: {
				line: "7125 Chestnut Street",
				city: "Bismarck",
				state: "ND",
				postalCode: "58501",
				country: "US",
			},
		});

		expect(createPatient({ seed: 2 }).demographics).toEqual({
			firstName: "David",
			lastName: "Martin",
			dob: "1965-09-04",
			age: 59,
			gender: "male",
			mrn: { value: "MRN155265", assigningAuthority: "clinical-faker" },
			address: {
				line: "7424 Maple Street",
				city: "Kansas City",
				state: "MO",
				postalCode: "64106",
				country: "US",
			},
		});

		expect(createPatient({ seed: 42 }).demographics).toEqual({
			firstName: "Mary",
			lastName: "Miller",
			dob: "1985-02-16",
			age: 39,
			gender: "female",
			mrn: { value: "MRN461577", assigningAuthority: "clinical-faker" },
			address: {
				line: "7439 Maple Street",
				city: "Springfield",
				state: "IL",
				postalCode: "62704",
				country: "US",
			},
		});

		expect(createPatient({ seed: 100 }).demographics).toEqual({
			firstName: "Mark",
			lastName: "Williams",
			dob: "1947-03-07",
			age: 77,
			gender: "male",
			mrn: { value: "MRN341226", assigningAuthority: "clinical-faker" },
			address: {
				line: "4355 Spring Street",
				city: "Milwaukee",
				state: "WI",
				postalCode: "53202",
				country: "US",
			},
		});
	});

	test("respects an explicit referenceDate override", () => {
		const patient = createPatient({ seed: 7, referenceDate: "2020-05-05" });
		expect(patient.referenceDate).toBe("2020-05-05");
	});

	test("toJSON() adds a vitals projection on top of the same underlying data", () => {
		const patient = createPatient({ seed: 7 });
		const json = patient.toJSON();

		expect(json.demographics).toEqual(patient.demographics);
		expect(json.vitals).toEqual({
			systolicBp: 138,
			diastolicBp: 93,
			heartRate: 82,
		});
	});

	test("JSON.stringify uses toJSON() automatically, per the JS serialization protocol", () => {
		const patient = createPatient({ seed: 7 });
		expect(JSON.stringify(patient)).toBe(JSON.stringify(patient.toJSON()));
	});

	test("toJSON() reflects the patient object's current state, not a stale snapshot", () => {
		const patient = createPatient({ seed: 7 });
		const replacement = [
			{
				id: "observation-1",
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

	test("toHL7() produces a well-formed ADT^A01 message carrying the patient's own data", () => {
		const patient = createPatient({ seed: 7 });
		const message = patient.toHL7("ADT^A01");

		expect(message.startsWith("MSH|")).toBe(true);
		expect(message).toContain(patient.demographics.mrn.value);
		expect(message).toContain(patient.demographics.lastName);
	});

	test("toHL7() is deterministic: the same seed and event type produce byte-identical output", () => {
		const a = createPatient({ seed: 7 }).toHL7("ADT^A01");
		const b = createPatient({ seed: 7 }).toHL7("ADT^A01");
		expect(a).toBe(b);

		// Also true for repeated calls on the very same Patient object.
		const patient = createPatient({ seed: 7 });
		expect(patient.toHL7("ADT^A01")).toBe(patient.toHL7("ADT^A01"));
	});

	test("toHL7() gives ADT^A01 and ADT^A08 from the same patient different default message control ids", () => {
		const patient = createPatient({ seed: 7 });
		const a01ControlId = patient.toHL7("ADT^A01").split("|")[9];
		const a08ControlId = patient.toHL7("ADT^A08").split("|")[9];
		expect(a01ControlId).not.toBe(a08ControlId);
	});

	test("toHL7() respects an HL7ExportOptions.messageControlId override", () => {
		const patient = createPatient({ seed: 7 });
		const message = patient.toHL7("ADT^A01", { messageControlId: "custom-id" });
		expect(message.split("|")[9]).toBe("custom-id");
	});

	test("toFHIR() defaults to a collection bundle keyed by the patient's own id", () => {
		const patient = createPatient({ seed: 7 });
		const bundle = patient.toFHIR();
		expect(bundle.type).toBe("collection");
		expect(bundle.entry[0]?.resource).toMatchObject({
			resourceType: "Patient",
			id: patient.id,
		});
	});

	test("toFHIR() is deterministic: the same seed and bundle type produce a deep-equal bundle", () => {
		expect(createPatient({ seed: 7 }).toFHIR("transaction")).toEqual(
			createPatient({ seed: 7 }).toFHIR("transaction"),
		);
	});

	test("toHL7('ORU^R01') now has OBX segments for generated observations", () => {
		const patient = createPatient({ seed: 42 });
		const message = patient.toHL7("ORU^R01");
		const lines = message.split("\r").filter(Boolean);
		const obxLines = lines.filter((l) => l.startsWith("OBX|"));
		expect(obxLines.length).toBe(patient.observations.length);
		expect(obxLines.length).toBeGreaterThan(0);
	});

	test("toFHIR() bundle includes Condition, Observation, and MedicationRequest entries whose references resolve and pairs BP into 85354-9 panel", () => {
		const patient = createPatient({ seed: 42 });
		const bundle = patient.toFHIR();
		const types = bundle.entry.map((e) => e.resource.resourceType);
		expect(types).toContain("Condition");
		expect(types).toContain("Observation");
		expect(types).toContain("MedicationRequest");

		const fullUrls = new Set(bundle.entry.map((e) => e.fullUrl));
		const references = [
			...JSON.stringify(bundle).matchAll(/"reference":"([^"]*)"/g),
		].map(([, reference]) => reference ?? "");
		expect(references.length).toBeGreaterThan(0);
		for (const reference of references) {
			expect(fullUrls.has(reference)).toBe(true);
		}

		// Blood pressure panel 85354-9 verification
		const observations = bundle.entry.flatMap((e) =>
			e.resource.resourceType === "Observation" ? [e.resource] : [],
		);
		const bpPanel = observations.find(
			(o) => o.code.coding?.some((c) => c.code === "85354-9") ?? false,
		);
		expect(bpPanel).toBeDefined();
		if (bpPanel === undefined) throw new Error("unreachable");
		const components = bpPanel.component;
		expect(components).toBeDefined();
		if (components === undefined) throw new Error("unreachable");
		const componentCodes = components.flatMap(
			(c) => c.code.coding?.map((coding) => coding.code) ?? [],
		);
		expect(componentCodes).toContain("8480-6"); // systolic
		expect(componentCodes).toContain("8462-4"); // diastolic
	});
});
