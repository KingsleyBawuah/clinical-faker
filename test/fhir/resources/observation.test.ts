import { describe, expect, test } from "bun:test";
import { MissingVitalSignUnitError } from "../../../src/core/errors.ts";
import type {
	Encounter,
	ObservationEntity,
} from "../../../src/entities/types.ts";
import { buildObservations } from "../../../src/fhir/resources/observation.ts";
import type { CodeableConcept } from "../../../src/fhir/types.ts";

const PATIENT_ID = "3f2c1b9e-8a7d-4c6b-9e5f-1a2b3c4d5e6f";
const ENCOUNTER_ID = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b";
const PROVIDER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const AT = "2024-03-01T09:00:00.000Z";
const LATER = "2024-03-01T15:00:00.000Z";

const LOINC = "http://loinc.org";
const UCUM = "http://unitsofmeasure.org";
const CATEGORY = "http://terminology.hl7.org/CodeSystem/observation-category";
const VITAL_SIGNS_PROFILE =
	"http://hl7.org/fhir/StructureDefinition/vitalsigns";
const BP_PROFILE = "http://hl7.org/fhir/StructureDefinition/bp";
const OXYGEN_SATURATION_PROFILE =
	"http://hl7.org/fhir/StructureDefinition/oxygensat";

const encounter: Encounter = {
	id: ENCOUNTER_ID,
	class: "inpatient",
	period: { start: "2024-03-01T08:00:00.000Z" },
	attendingProvider: {
		id: PROVIDER_ID,
		identifier: { value: "1234567893", assigningAuthority: "NPI" },
		firstName: "Sam",
		lastName: "Rivera",
	},
};

const glucose: ObservationEntity = {
	id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
	loincCode: "2345-7",
	display: "Glucose [Mass/volume] in Serum or Plasma",
	value: 182,
	unit: "mg/dL",
	effectiveDateTime: AT,
	referenceRange: { low: 70, high: 99 },
	abnormalFlag: "H",
};

const heartRate: ObservationEntity = {
	id: "1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e",
	loincCode: "8867-4",
	display: "Heart rate",
	value: 72,
	unit: "/min",
	effectiveDateTime: AT,
};

function bloodPressure(
	id: string,
	side: "systolic" | "diastolic",
	value: number,
	effectiveDateTime: string,
): ObservationEntity {
	return {
		id,
		loincCode: side === "systolic" ? "8480-6" : "8462-4",
		display:
			side === "systolic"
				? "Systolic blood pressure"
				: "Diastolic blood pressure",
		value,
		unit: "mm[Hg]",
		effectiveDateTime,
	};
}

const SYSTOLIC_ID = "2c3d4e5f-6a7b-4c8d-8e9f-1a2b3c4d5e6f";
const DIASTOLIC_ID = "3d4e5f6a-7b8c-4d9e-9f0a-2b3c4d5e6f7a";

describe("buildObservations", () => {
	test("compiles a lab result with laboratory category, UCUM quantity, range, and interpretation", () => {
		expect(buildObservations([glucose], PATIENT_ID, encounter)).toEqual([
			{
				resourceType: "Observation",
				id: glucose.id,
				status: "final",
				category: [{ coding: [{ system: CATEGORY, code: "laboratory" }] }],
				code: {
					coding: [
						{
							system: LOINC,
							code: "2345-7",
							display: "Glucose [Mass/volume] in Serum or Plasma",
						},
					],
				},
				subject: { reference: `urn:uuid:${PATIENT_ID}` },
				encounter: { reference: `urn:uuid:${ENCOUNTER_ID}` },
				performer: [{ reference: `urn:uuid:${PROVIDER_ID}` }],
				effectiveDateTime: AT,
				valueQuantity: {
					value: 182,
					unit: "mg/dL",
					system: UCUM,
					code: "mg/dL",
				},
				interpretation: [
					{
						coding: [
							{
								system:
									"http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
								code: "H",
							},
						],
					},
				],
				referenceRange: [
					{
						low: { value: 70, unit: "mg/dL", system: UCUM, code: "mg/dL" },
						high: { value: 99, unit: "mg/dL", system: UCUM, code: "mg/dL" },
					},
				],
			},
		]);
	});

	test("uses valueString for a non-numeric result and a bare quantity when there's no unit", () => {
		const { referenceRange: _range, ...unranged } = glucose;
		const { unit: _unit, ...withoutUnit } = unranged;
		const [text, unitless] = buildObservations(
			[
				{ ...unranged, value: "Positive" },
				{ ...withoutUnit, id: heartRate.id },
			],
			PATIENT_ID,
			encounter,
		);
		expect(text?.valueString).toBe("Positive");
		expect(text?.valueQuantity).toBeUndefined();
		expect(unitless?.valueQuantity).toEqual({ value: 182 });
	});

	test("gives a vital sign the vital-signs category and profile", () => {
		const [resource] = buildObservations([heartRate], PATIENT_ID, encounter);
		expect(resource?.category).toEqual([
			{ coding: [{ system: CATEGORY, code: "vital-signs" }] },
		]);
		expect(resource?.meta).toEqual({ profile: [VITAL_SIGNS_PROFILE] });
		expect(resource?.valueQuantity).toEqual({
			value: 72,
			unit: "/min",
			system: UCUM,
			code: "/min",
		});
	});

	test("pairs systolic and diastolic readings at the same time into one 85354-9 panel", () => {
		const resources = buildObservations(
			[
				bloodPressure(SYSTOLIC_ID, "systolic", 128, AT),
				heartRate,
				bloodPressure(DIASTOLIC_ID, "diastolic", 82, AT),
			],
			PATIENT_ID,
			encounter,
		);
		expect(resources.map((resource) => resource.id)).toEqual([
			SYSTOLIC_ID,
			heartRate.id,
		]);
		const [panel] = resources;
		expect(panel).toEqual({
			resourceType: "Observation",
			id: SYSTOLIC_ID,
			meta: { profile: [VITAL_SIGNS_PROFILE, BP_PROFILE] },
			status: "final",
			category: [{ coding: [{ system: CATEGORY, code: "vital-signs" }] }],
			code: {
				coding: [
					{
						system: LOINC,
						code: "85354-9",
						display: "Blood pressure panel with all children optional",
					},
				],
			},
			subject: { reference: `urn:uuid:${PATIENT_ID}` },
			encounter: { reference: `urn:uuid:${ENCOUNTER_ID}` },
			performer: [{ reference: `urn:uuid:${PROVIDER_ID}` }],
			effectiveDateTime: AT,
			component: [
				{
					code: {
						coding: [
							{
								system: LOINC,
								code: "8480-6",
								display: "Systolic blood pressure",
							},
						],
					},
					valueQuantity: {
						value: 128,
						unit: "mm[Hg]",
						system: UCUM,
						code: "mm[Hg]",
					},
				},
				{
					code: {
						coding: [
							{
								system: LOINC,
								code: "8462-4",
								display: "Diastolic blood pressure",
							},
						],
					},
					valueQuantity: {
						value: 82,
						unit: "mm[Hg]",
						system: UCUM,
						code: "mm[Hg]",
					},
				},
			],
		});
	});

	test("pairs repeated same-time readings in order instead of leaving half-empty panels", () => {
		const S2 = "6a7b8c9d-0e1f-4a2b-8c3d-5e6f7a8b9c0d";
		const D2 = "7b8c9d0e-1f2a-4b3c-9d4e-6f7a8b9c0d1e";
		const panels = buildObservations(
			[
				bloodPressure(SYSTOLIC_ID, "systolic", 128, AT),
				bloodPressure(S2, "systolic", 131, AT),
				bloodPressure(DIASTOLIC_ID, "diastolic", 82, AT),
				bloodPressure(D2, "diastolic", 85, AT),
			],
			PATIENT_ID,
			encounter,
		);
		expect(
			panels.map((panel) => [
				panel.id,
				panel.component?.map((component) => component.valueQuantity?.value),
			]),
		).toEqual([
			[SYSTOLIC_ID, [128, 82]],
			[S2, [131, 85]],
		]);
	});

	test("pairs readings at the same instant written with different UTC offsets", () => {
		const panels = buildObservations(
			[
				bloodPressure(SYSTOLIC_ID, "systolic", 128, AT),
				bloodPressure(
					DIASTOLIC_ID,
					"diastolic",
					82,
					"2024-03-01T04:00:00.000-05:00",
				),
			],
			PATIENT_ID,
			encounter,
		);
		expect(panels).toHaveLength(1);
		expect(panels[0]?.effectiveDateTime).toBe(AT);
	});

	test("keeps a text vital sign as an as-text dataAbsentReason, since vital-sign profiles only allow a Quantity", () => {
		const [resource] = buildObservations(
			[{ ...heartRate, value: "Irregular" }],
			PATIENT_ID,
			encounter,
		);
		expect(resource?.valueString).toBeUndefined();
		expect(resource?.dataAbsentReason).toEqual({
			coding: [
				{
					system: "http://terminology.hl7.org/CodeSystem/data-absent-reason",
					code: "as-text",
				},
			],
			text: "Irregular",
		});
		expect(resource?.meta).toEqual({ profile: [VITAL_SIGNS_PROFILE] });
	});

	test("throws MissingVitalSignUnitError for a numeric vital sign or BP reading with no unit", () => {
		const { unit: _unit, ...unitless } = heartRate;
		expect(() => buildObservations([unitless], PATIENT_ID, encounter)).toThrow(
			MissingVitalSignUnitError,
		);
		const { unit: _bpUnit, ...unitlessBP } = bloodPressure(
			SYSTOLIC_ID,
			"systolic",
			128,
			AT,
		);
		expect(() =>
			buildObservations([unitlessBP], PATIENT_ID, encounter),
		).toThrow(MissingVitalSignUnitError);
	});

	test("codes SpO2 with 2708-6 as well, and claims the oxygen-saturation profile", () => {
		const [resource] = buildObservations(
			[
				{
					id: SYSTOLIC_ID,
					loincCode: "59408-5",
					display: "Oxygen saturation in Arterial blood by Pulse oximetry",
					value: 97,
					unit: "%",
					effectiveDateTime: AT,
				},
			],
			PATIENT_ID,
			encounter,
		);
		expect(resource?.code).toEqual({
			coding: [
				{
					system: LOINC,
					code: "59408-5",
					display: "Oxygen saturation in Arterial blood by Pulse oximetry",
				},
				{
					system: LOINC,
					code: "2708-6",
					display: "Oxygen saturation in Arterial blood",
				},
			],
		});
		expect(resource?.meta).toEqual({
			profile: [VITAL_SIGNS_PROFILE, OXYGEN_SATURATION_PROFILE],
		});
	});

	test("keeps the panel id from whichever reading comes first", () => {
		const [panel] = buildObservations(
			[
				bloodPressure(DIASTOLIC_ID, "diastolic", 82, AT),
				bloodPressure(SYSTOLIC_ID, "systolic", 128, AT),
			],
			PATIENT_ID,
			encounter,
		);
		expect(panel?.id).toBe(DIASTOLIC_ID);
		// Components stay systolic-then-diastolic regardless of input order.
		expect(
			panel?.component?.map((component) => component.code.coding?.[0]?.code),
		).toEqual(["8480-6", "8462-4"]);
	});

	test("an unpaired reading becomes a panel with dataAbsentReason on the missing component", () => {
		const resources = buildObservations(
			[
				bloodPressure(SYSTOLIC_ID, "systolic", 128, AT),
				bloodPressure(DIASTOLIC_ID, "diastolic", 82, LATER),
			],
			PATIENT_ID,
			encounter,
		);
		const unknown: CodeableConcept = {
			coding: [
				{
					system: "http://terminology.hl7.org/CodeSystem/data-absent-reason",
					code: "unknown",
				},
			],
		};
		expect(resources).toHaveLength(2);
		expect(resources[0]?.component?.[1]).toEqual({
			code: {
				coding: [
					{
						system: LOINC,
						code: "8462-4",
						display: "Diastolic blood pressure",
					},
				],
			},
			dataAbsentReason: unknown,
		});
		expect(resources[1]?.component?.[0]).toEqual({
			code: {
				coding: [
					{ system: LOINC, code: "8480-6", display: "Systolic blood pressure" },
				],
			},
			dataAbsentReason: unknown,
		});
		expect(resources[1]?.effectiveDateTime).toBe(LATER);
	});

	test("a repeated reading at the same time starts a new panel instead of overwriting", () => {
		const resources = buildObservations(
			[
				bloodPressure(SYSTOLIC_ID, "systolic", 128, AT),
				bloodPressure(DIASTOLIC_ID, "systolic", 131, AT),
			],
			PATIENT_ID,
			encounter,
		);
		expect(resources.map((resource) => resource.id)).toEqual([
			SYSTOLIC_ID,
			DIASTOLIC_ID,
		]);
	});

	test("keeps a non-numeric BP reading as as-text dataAbsentReason, since the bp profile only allows a Quantity", () => {
		const [panel] = buildObservations(
			[
				{
					...bloodPressure(SYSTOLIC_ID, "systolic", 0, AT),
					value: "Unable to obtain",
				},
			],
			PATIENT_ID,
			encounter,
		);
		expect(panel?.component?.[0]?.dataAbsentReason).toEqual({
			coding: [
				{
					system: "http://terminology.hl7.org/CodeSystem/data-absent-reason",
					code: "as-text",
				},
			],
			text: "Unable to obtain",
		});
	});

	test("carries a BP reading's interpretation and range onto its component", () => {
		const [panel] = buildObservations(
			[
				{
					...bloodPressure(SYSTOLIC_ID, "systolic", 150, AT),
					referenceRange: { low: 90, high: 120 },
					abnormalFlag: "H",
				},
			],
			PATIENT_ID,
			encounter,
		);
		const [systolic] = panel?.component ?? [];
		expect(systolic?.interpretation?.[0]?.coding?.[0]?.code).toBe("H");
		expect(systolic?.referenceRange?.[0]?.high.value).toBe(120);
		expect(panel?.interpretation).toBeUndefined();
	});

	test("returns no resources for no observations", () => {
		expect(buildObservations([], PATIENT_ID, encounter)).toEqual([]);
	});
});
