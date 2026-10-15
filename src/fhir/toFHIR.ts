import { NoEncounterForClinicalDataError } from "../core/errors.ts";
import { createMulberry32 } from "../core/prng/mulberry32.ts";
import { generateSeededUUID } from "../core/prng/uuid.ts";
import type { PatientGraph } from "../entities/types.ts";
import { assertExhaustive } from "./assertExhaustive.ts";
import { reference } from "./datatypes.ts";
import { buildAllergyIntolerance } from "./resources/allergyIntolerance.ts";
import { buildCondition } from "./resources/condition.ts";
import { buildEncounter } from "./resources/encounter.ts";
import { buildMedicationRequest } from "./resources/medicationRequest.ts";
import { buildObservations } from "./resources/observation.ts";
import { buildPatient } from "./resources/patient.ts";
import { buildPractitioner } from "./resources/practitioner.ts";
import type {
	Bundle,
	CollectionBundleEntry,
	FHIRBundleType,
	FHIRResource,
} from "./types.ts";

/**
 * Conditions, observations, and medications, all attached to the patient's
 * first encounter: the IR doesn't record which encounter each belongs to,
 * and generated patients have exactly one.
 */
function buildEncounterBoundResources(patient: PatientGraph): FHIRResource[] {
	const { conditions, observations, medications } = patient;
	if (
		conditions.length === 0 &&
		observations.length === 0 &&
		medications.length === 0
	) {
		return [];
	}
	const [first] = patient.encounters;
	if (first === undefined) {
		throw new NoEncounterForClinicalDataError(patient.id);
	}
	return [
		...conditions.map((condition) =>
			buildCondition(condition, patient.id, first.id),
		),
		...buildObservations(observations, patient.id, first),
		...medications.map((medication) =>
			buildMedicationRequest(medication, patient.id, first.id),
		),
	];
}

/**
 * Every resource compiled from the IR, Patient first. A provider attending
 * several encounters is emitted once — its IR id is its resource id, so a
 * second copy would be a duplicate `fullUrl`. A blood-pressure pair becomes
 * one panel `Observation`, so the bundle can hold fewer entries than the IR
 * has entities.
 */
function buildResources(patient: PatientGraph): FHIRResource[] {
	const resources: FHIRResource[] = [
		buildPatient(patient.id, patient.demographics),
	];
	const emittedProviderIds = new Set<string>();
	for (const encounter of patient.encounters) {
		const provider = encounter.attendingProvider;
		if (!emittedProviderIds.has(provider.id)) {
			emittedProviderIds.add(provider.id);
			resources.push(buildPractitioner(provider));
		}
		resources.push(buildEncounter(encounter, patient.id));
	}
	resources.push(
		...buildEncounterBoundResources(patient),
		...patient.allergies.map((allergy) =>
			buildAllergyIntolerance(allergy, patient.id),
		),
	);
	return resources;
}

/**
 * Compiles the canonical IR into a FHIR R4 `Bundle`. Each entry's `fullUrl`
 * is `urn:uuid:<id>`, the same string every `Reference` to it uses (see
 * docs/architecture.md's "FHIR R4 referential integrity"). `Bundle.id` comes
 * from its own PRNG stream forked by `bundleType`, like `.toHL7()`'s message
 * control id, so the same seed and bundle type always produce a deep-equal
 * bundle.
 */
export function toFHIR(
	patient: PatientGraph,
	bundleType: FHIRBundleType = "collection",
): Bundle {
	const id = generateSeededUUID(
		createMulberry32(patient.seed).fork(`fhir:${bundleType}`),
	);
	const entry: CollectionBundleEntry[] = buildResources(patient).map(
		(resource) => ({ fullUrl: reference(resource.id).reference, resource }),
	);

	switch (bundleType) {
		case "collection":
			return { resourceType: "Bundle", id, type: "collection", entry };
		case "transaction":
			return {
				resourceType: "Bundle",
				id,
				type: "transaction",
				entry: entry.map(({ fullUrl, resource }) => ({
					fullUrl,
					resource,
					request: { method: "POST", url: resource.resourceType },
				})),
			};
		default:
			return assertExhaustive(bundleType);
	}
}
