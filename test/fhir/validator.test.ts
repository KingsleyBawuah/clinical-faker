import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import FhirValidator, {
	type OperationOutcomeIssue,
} from "fhir-validator-wrapper";
import type { EncounterClass, PatientGraph } from "../../src/entities/types.ts";
import { buildEncounter } from "../../src/fhir/resources/encounter.ts";
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
 * doesn't generate.
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

/** Every resource 3b can build for a patient. */
function buildResources(graph: PatientGraph): FHIRResource[] {
	return [
		buildPatient(graph.id, graph.demographics),
		...graph.encounters.flatMap((encounter) => [
			buildPractitioner(encounter.attendingProvider),
			buildEncounter(encounter, graph.id),
		]),
	];
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
			.filter((issue) => !issue.includes(NARRATIVE_CONSTRAINT));
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

	for (const seed of SEEDS) {
		test(
			`seed ${seed}: Patient, Practitioner, and Encounter validate`,
			async () => {
				for (const resource of buildResources(
					createPatient({ seed }).toJSON(),
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
