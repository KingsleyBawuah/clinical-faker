import type { AssigningAuthority } from "../entities/types.ts";
import { assertExhaustive } from "./assertExhaustive.ts";

// Code and identifier system URIs — see docs/architecture.md's "FHIR R4
// compilation" section for the source of each. The ones marked unverified
// there get confirmed by the validator in the PR that first uses them.

export const LOINC_SYSTEM = "http://loinc.org";
export const UCUM_SYSTEM = "http://unitsofmeasure.org";
export const RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm";
export const ENCOUNTER_CLASS_SYSTEM =
	"http://terminology.hl7.org/CodeSystem/v3-ActCode";
export const OBSERVATION_INTERPRETATION_SYSTEM =
	"http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";
/** Secondary source only — confirmed by the validator in PR 3c. */
export const ICD10CM_SYSTEM = "http://hl7.org/fhir/sid/icd-10-cm";
/** Conflicting sources — settled by the validator in PR 3c. */
export const OBSERVATION_CATEGORY_SYSTEM =
	"http://terminology.hl7.org/CodeSystem/observation-category";
/** Confirmed by the FHIR validator in PR 3b — it knows this URI, and rejects the older `http://hl7.org/fhir/sid/npi`. */
export const NPI_SYSTEM = "http://hl7.org/fhir/sid/us-npi";
/** This library's own namespace; a URN so it can never collide with a real organization's domain. */
export const MRN_SYSTEM = "urn:clinical-faker:mrn";

/** `Identifier.system` for each authority the IR issues identifiers under. `clinical-faker` only issues MRNs today. */
export function toFHIRIdentifierSystem(authority: AssigningAuthority): string {
	switch (authority) {
		case "NPI":
			return NPI_SYSTEM;
		case "clinical-faker":
			return MRN_SYSTEM;
		default:
			return assertExhaustive(authority);
	}
}
