import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import FhirValidator, {
	type OperationOutcomeIssue,
} from "fhir-validator-wrapper";
import type {
	AllergyEntity,
	ConditionEntity,
	EncounterClass,
	MedicationEntity,
	ObservationEntity,
	PatientGraph,
} from "../../src/entities/types.ts";
import { buildAllergyIntolerance } from "../../src/fhir/resources/allergyIntolerance.ts";
import { buildCondition } from "../../src/fhir/resources/condition.ts";
import { buildEncounter } from "../../src/fhir/resources/encounter.ts";
import { buildMedicationRequest } from "../../src/fhir/resources/medicationRequest.ts";
import { buildObservations } from "../../src/fhir/resources/observation.ts";
import { buildPatient } from "../../src/fhir/resources/patient.ts";
import { buildPractitioner } from "../../src/fhir/resources/practitioner.ts";
import type { FHIRResource } from "../../src/fhir/types.ts";
import { createPatient } from "../../src/generator.ts";

/**
 * Validates generated resources against the official HL7 FHIR reference
 * validator, via `fhir-validator-wrapper` (devDependency only — see
 * docs/architecture.md's "Cross-validation with independent parsers").
 *
 * Needs Java, and downloads the validator JAR on first run, so it's skipped
 * unless `FHIR_VALIDATOR=1`. Runs with `-tx n/a` (no terminology server):
 * structure, cardinality, invariants, and profiles are checked, and so are
 * codes from code systems the validator bundles (e.g. v3-ActCode) — only
 * external ones (LOINC, ICD-10-CM, RxNorm) go unchecked.
 *
 * Fails on any warning, not just errors, so an unknown code system surfaces
 * — except dom-6 ("should have narrative"), which this library deliberately
 * doesn't generate, and the two UCUM warnings `-tx n/a` always raises because
 * the validator can't check UCUM codes without a terminology server.
 */
const ENABLED = process.env.FHIR_VALIDATOR === "1";
const JAR_PATH =
	process.env.FHIR_VALIDATOR_JAR ?? ".fhir-validator/validator_cli.jar";
const FHIR_VERSION = "4.0.1";
const PORT = 8085;
const MS_PER_MINUTE = 60_000;
/** First run downloads the ~200 MB validator JAR plus the R4 core packages. */
const STARTUP_TIMEOUT_MS = 10 * MS_PER_MINUTE;
const VALIDATE_TIMEOUT_MS = MS_PER_MINUTE;
const SEEDS = [1, 2, 3, 42, 1234];
/** Best-practice "resources should have narrative" — `text` is intentionally not generated. */
const NARRATIVE_CONSTRAINT = "dom-6:";
const UCUM_SYSTEM = "http://unitsofmeasure.org";
/** The validator's wording for "can't check this code offline" — only ignored for UCUM. */
const NO_TERMINOLOGY_SERVICE = [
	"because the validator is running without terminology services",
	"but the definition doesn't include any codes",
];

function isExpectedWarning(issue: string): boolean {
	return (
		issue.includes(NARRATIVE_CONSTRAINT) ||
		(issue.includes(UCUM_SYSTEM) &&
			NO_TERMINOLOGY_SERVICE.some((phrase) => issue.includes(phrase)))
	);
}
const ENCOUNTER_CLASSES: EncounterClass[] = [
	"inpatient",
	"outpatient",
	"emergency",
];

function describeIssue(issue: OperationOutcomeIssue): string {
	const where = issue.expression?.join(", ") ?? issue.location?.join(", ");
	const message = issue.details?.text ?? issue.diagnostics ?? issue.code;
	return `${issue.severity} @ ${where ?? "?"}: ${message}`;
}

/** Every resource the builders produce for a patient, with clinical entities attached to its first encounter. */
function buildResources(graph: PatientGraph): FHIRResource[] {
	const [first] = graph.encounters;
	const clinical: FHIRResource[] =
		first === undefined
			? []
			: [
					...graph.conditions.map((condition) =>
						buildCondition(condition, graph.id, first.id),
					),
					...buildObservations(graph.observations, graph.id, first),
					...graph.medications.map((medication) =>
						buildMedicationRequest(medication, graph.id, first.id),
					),
				];
	return [
		buildPatient(graph.id, graph.demographics),
		...graph.encounters.flatMap((encounter) => [
			buildPractitioner(encounter.attendingProvider),
			buildEncounter(encounter, graph.id),
		]),
		...clinical,
		...graph.allergies.map((allergy) =>
			buildAllergyIntolerance(allergy, graph.id),
		),
	];
}

// Hand-built until Phase 4's archetypes generate these — synthetic values only.
const AT = "2024-03-01T09:00:00.000Z";
const LATER = "2024-03-01T15:00:00.000Z";
const FIXTURE_CONDITIONS: ConditionEntity[] = [
	{
		id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
		code: "I10",
		display: "Essential (primary) hypertension",
		onsetDate: "2023-11-20",
		rank: "primary",
	},
	{
		id: "c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f",
		code: "E78.5",
		display: "Hyperlipidemia, unspecified",
		rank: "secondary",
	},
];
const FIXTURE_OBSERVATIONS: ObservationEntity[] = [
	{
		id: "2c3d4e5f-6a7b-4c8d-8e9f-1a2b3c4d5e6f",
		loincCode: "8480-6",
		display: "Systolic blood pressure",
		value: 152,
		unit: "mm[Hg]",
		effectiveDateTime: AT,
		referenceRange: { low: 90, high: 120 },
		abnormalFlag: "H",
	},
	{
		id: "3d4e5f6a-7b8c-4d9e-9f0a-2b3c4d5e6f7a",
		loincCode: "8462-4",
		display: "Diastolic blood pressure",
		value: 94,
		unit: "mm[Hg]",
		effectiveDateTime: AT,
	},
	// Unpaired — becomes a panel with dataAbsentReason on the systolic side.
	{
		id: "4e5f6a7b-8c9d-4e0f-8a1b-3c4d5e6f7a8b",
		loincCode: "8462-4",
		display: "Diastolic blood pressure",
		value: 88,
		unit: "mm[Hg]",
		effectiveDateTime: LATER,
	},
	{
		id: "1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e",
		loincCode: "8867-4",
		display: "Heart rate",
		value: 72,
		unit: "/min",
		effectiveDateTime: AT,
	},
	{
		id: "6a7b8c9d-0e1f-4a2b-8c3d-5e6f7a8b9c0d",
		loincCode: "8310-5",
		display: "Body temperature",
		value: 37.2,
		unit: "Cel",
		effectiveDateTime: AT,
	},
	{
		id: "7b8c9d0e-1f2a-4b3c-9d4e-6f7a8b9c0d1e",
		loincCode: "9279-1",
		display: "Respiratory rate",
		value: 16,
		unit: "/min",
		effectiveDateTime: AT,
	},
	{
		id: "8c9d0e1f-2a3b-4c4d-8e5f-7a8b9c0d1e2f",
		loincCode: "59408-5",
		display: "Oxygen saturation in Arterial blood by Pulse oximetry",
		value: 97,
		unit: "%",
		effectiveDateTime: AT,
	},
	// A text vital sign — emitted as an as-text dataAbsentReason.
	{
		id: "9d0e1f2a-3b4c-4d5e-9f6a-8b9c0d1e2f3a",
		loincCode: "8867-4",
		display: "Heart rate",
		value: "Irregular",
		effectiveDateTime: LATER,
	},
	{
		id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
		loincCode: "2345-7",
		display: "Glucose [Mass/volume] in Serum or Plasma",
		value: 182,
		unit: "mg/dL",
		effectiveDateTime: AT,
		referenceRange: { low: 70, high: 99 },
		abnormalFlag: "H",
	},
	{
		id: "5f6a7b8c-9d0e-4f1a-9b2c-4d5e6f7a8b9c",
		loincCode: "5778-6",
		display: "Color of Urine",
		value: "Yellow",
		effectiveDateTime: AT,
	},
];
const FIXTURE_MEDICATIONS: MedicationEntity[] = [
	{
		id: "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f7a",
		name: "lisinopril 10 MG Oral Tablet",
		rxcui: "314076",
		sig: "Take 1 tablet by mouth once daily",
	},
];
const FIXTURE_ALLERGIES: AllergyEntity[] = [
	{
		id: "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b",
		substance: "Penicillin",
		reaction: "Hives",
		criticality: "high",
	},
	{ id: "f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f7a8b9c", substance: "Latex" },
];

function withClinicalFixtures(graph: PatientGraph): PatientGraph {
	return {
		...graph,
		conditions: FIXTURE_CONDITIONS,
		observations: FIXTURE_OBSERVATIONS,
		medications: FIXTURE_MEDICATIONS,
		allergies: FIXTURE_ALLERGIES,
	};
}

describe.skipIf(!ENABLED)("FHIR R4 reference validator", () => {
	const validator = new FhirValidator(JAR_PATH);

	beforeAll(
		() =>
			validator.start({
				version: FHIR_VERSION,
				txServer: "n/a",
				txLog: ".fhir-validator/txlog.txt",
				port: PORT,
				timeout: STARTUP_TIMEOUT_MS,
				skipUpdateCheck: true,
			}),
		STARTUP_TIMEOUT_MS,
	);

	afterAll(() => validator.stop());

	async function problemsWith(resource: object): Promise<string[]> {
		const outcome = await validator.validate(resource);
		return (outcome.issue ?? [])
			.filter((issue) => issue.severity !== "information")
			.map(describeIssue)
			.filter((issue) => !isExpectedWarning(issue));
	}

	async function expectValid(resource: FHIRResource): Promise<void> {
		const problems = await problemsWith(resource);
		expect(
			problems,
			`${resource.resourceType}/${resource.id}:\n${problems.join("\n")}`,
		).toEqual([]);
	}

	// Guards against a harness that passes everything (e.g. a validator that
	// never actually loaded R4).
	test(
		"rejects an Encounter with an unknown class code",
		async () => {
			const graph = createPatient({ seed: 1 }).toJSON();
			const [encounter] = graph.encounters;
			if (encounter === undefined) throw new Error("unreachable");
			const resource = buildEncounter(encounter, graph.id);
			const problems = await problemsWith({
				...resource,
				class: { ...resource.class, code: "NOT-A-CODE" },
			});
			expect(problems.length).toBeGreaterThan(0);
		},
		VALIDATE_TIMEOUT_MS,
	);

	// Settles the observation-category URI: the older one from the R4
	// terminologies page must be rejected, or the guard below proves nothing.
	test(
		"rejects the older observation-category system URI",
		async () => {
			const graph = withClinicalFixtures(createPatient({ seed: 1 }).toJSON());
			const [encounter] = graph.encounters;
			if (encounter === undefined) throw new Error("unreachable");
			const [lab] = buildObservations(
				FIXTURE_OBSERVATIONS.filter((o) => o.loincCode === "2345-7"),
				graph.id,
				encounter,
			);
			if (lab === undefined) throw new Error("unreachable");
			const problems = await problemsWith({
				...lab,
				category: [
					{
						coding: [
							{
								system: "http://hl7.org/fhir/observation-category",
								code: "laboratory",
							},
						],
					},
				],
			});
			expect(problems.length).toBeGreaterThan(0);
		},
		VALIDATE_TIMEOUT_MS,
	);

	// Same check for ICD-10-CM: a near-miss hl7.org URI must be rejected, so
	// the real one passing the seed tests below confirms it.
	test(
		"rejects a wrong ICD-10-CM system URI",
		async () => {
			const graph = createPatient({ seed: 1 }).toJSON();
			const [encounter] = graph.encounters;
			const [condition] = FIXTURE_CONDITIONS;
			if (encounter === undefined || condition === undefined) {
				throw new Error("unreachable");
			}
			const resource = buildCondition(condition, graph.id, encounter.id);
			const problems = await problemsWith({
				...resource,
				code: {
					coding: [
						{
							system: "http://hl7.org/fhir/sid/icd10cm",
							code: condition.code,
							display: condition.display,
						},
					],
				},
			});
			expect(problems.length).toBeGreaterThan(0);
		},
		VALIDATE_TIMEOUT_MS,
	);

	for (const seed of SEEDS) {
		test(
			`seed ${seed}: every resource validates, with hand-built clinical entities`,
			async () => {
				for (const resource of buildResources(
					withClinicalFixtures(createPatient({ seed }).toJSON()),
				)) {
					await expectValid(resource);
				}
			},
			VALIDATE_TIMEOUT_MS,
		);
	}

	// Seeds alone don't guarantee every class and both statuses get covered.
	for (const encounterClass of ENCOUNTER_CLASSES) {
		for (const ended of [true, false]) {
			test(
				`a ${ended ? "finished" : "in-progress"} ${encounterClass} Encounter validates`,
				async () => {
					const graph = createPatient({ seed: 7 }).toJSON();
					const [encounter] = graph.encounters;
					if (encounter === undefined) throw new Error("unreachable");
					const start = encounter.period.start;
					await expectValid(
						buildEncounter(
							{
								...encounter,
								class: encounterClass,
								period: ended
									? {
											start,
											end: new Date(
												Date.parse(start) + MS_PER_MINUTE * 60,
											).toISOString(),
										}
									: { start },
							},
							graph.id,
						),
					);
				},
				VALIDATE_TIMEOUT_MS,
			);
		}
	}
});
