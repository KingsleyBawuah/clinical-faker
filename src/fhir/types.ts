import type { ENCOUNTER_CLASS_SYSTEM } from "./systems.ts";

// Hand-written FHIR R4 (4.0.1) interfaces — only the resources and elements
// this library emits, with R4's required (min 1) elements non-optional. See
// docs/architecture.md's "FHIR R4 compilation" section for why these aren't
// `@types/fhir`. Fixed codes are narrowed to the values this library supplies.

// --- Datatypes ---

export interface Coding {
	system: string;
	code: string;
	display?: string;
}

/** At least one coding, or text alone (e.g. an allergy substance the IR has no code for) — never empty. */
export type CodeableConcept =
	| { coding: [Coding, ...Coding[]]; text?: string }
	| { coding?: never; text: string };

/** Always a `urn:uuid:<id>` pointing at another entry in the same Bundle. */
export interface Reference {
	reference: string;
}

export interface Identifier {
	system: string;
	value: string;
}

export interface HumanName {
	family: string;
	given: string[];
}

export interface Address {
	line: string[];
	city: string;
	state: string;
	postalCode: string;
	country: string;
}

export interface Period {
	start: string;
	end?: string;
}

export interface Quantity {
	value: number;
	unit?: string;
	system?: string;
	code?: string;
}

export interface Meta {
	profile: string[];
}

// --- Resources ---

export type AdministrativeGender = "male" | "female" | "other" | "unknown";

export interface Patient {
	resourceType: "Patient";
	id: string;
	identifier: Identifier[];
	name: HumanName[];
	gender: AdministrativeGender;
	birthDate: string;
	address: Address[];
}

export interface Practitioner {
	resourceType: "Practitioner";
	id: string;
	identifier: Identifier[];
	name: HumanName[];
}

export interface EncounterParticipant {
	individual: Reference;
}

export interface EncounterClassCoding {
	system: typeof ENCOUNTER_CLASS_SYSTEM;
	code: "IMP" | "AMB" | "EMER";
	display?: string;
}

export interface Encounter {
	resourceType: "Encounter";
	id: string;
	/** `finished` when `period.end` exists, else `in-progress`. */
	status: "finished" | "in-progress";
	/** R4's `Encounter.class` is a single `Coding` (1..1), not a `CodeableConcept`. */
	class: EncounterClassCoding;
	subject: Reference;
	period: Period;
	participant: EncounterParticipant[];
}

export interface Condition {
	resourceType: "Condition";
	id: string;
	clinicalStatus: CodeableConcept;
	verificationStatus: CodeableConcept;
	category: CodeableConcept[];
	code: CodeableConcept;
	subject: Reference;
	encounter: Reference;
	onsetDateTime?: string;
}

export interface ObservationReferenceRange {
	low: Quantity;
	high: Quantity;
}

/** An observed value's interpretation and normal range — shared by an `Observation` and its components. */
export interface ObservationInterpretationAndRange {
	interpretation?: CodeableConcept[];
	referenceRange?: ObservationReferenceRange[];
}

/** Exactly one of a value or the reason it's missing — how the vital-signs blood-pressure panel marks an unpaired reading. */
export type ObservationComponent = {
	code: CodeableConcept;
} & ObservationInterpretationAndRange &
	(
		| { valueQuantity: Quantity; dataAbsentReason?: never }
		| { valueQuantity?: never; dataAbsentReason: CodeableConcept }
	);

export interface ObservationBase {
	resourceType: "Observation";
	id: string;
	meta?: Meta;
	status: "final";
	category: CodeableConcept[];
	code: CodeableConcept;
	subject: Reference;
	encounter: Reference;
	effectiveDateTime: string;
	performer: Reference[];
	interpretation?: CodeableConcept[];
	referenceRange?: ObservationReferenceRange[];
	component?: ObservationComponent[];
}

/**
 * At most one of `valueQuantity`/`valueString`/`dataAbsentReason` (R4 obs-6:
 * `dataAbsentReason` only when there's no value). A blood-pressure panel
 * carries none — its values live in `component`.
 */
export type ObservationValue =
	| { valueQuantity: Quantity; valueString?: never; dataAbsentReason?: never }
	| { valueQuantity?: never; valueString: string; dataAbsentReason?: never }
	| {
			valueQuantity?: never;
			valueString?: never;
			dataAbsentReason: CodeableConcept;
	  }
	| { valueQuantity?: never; valueString?: never; dataAbsentReason?: never };

export type Observation = ObservationBase & ObservationValue;

export interface Dosage {
	text: string;
}

export interface MedicationRequest {
	resourceType: "MedicationRequest";
	id: string;
	status: "active";
	intent: "order";
	medicationCodeableConcept: CodeableConcept;
	subject: Reference;
	encounter: Reference;
	dosageInstruction: Dosage[];
}

export type AllergyIntoleranceCriticality = "low" | "high" | "unable-to-assess";

export interface AllergyIntoleranceReaction {
	/** 1..* in R4. */
	manifestation: [CodeableConcept, ...CodeableConcept[]];
}

export interface AllergyIntolerance {
	resourceType: "AllergyIntolerance";
	id: string;
	clinicalStatus: CodeableConcept;
	verificationStatus: CodeableConcept;
	code: CodeableConcept;
	patient: Reference;
	criticality?: AllergyIntoleranceCriticality;
	reaction?: AllergyIntoleranceReaction[];
}

export type FHIRResource =
	| Patient
	| Practitioner
	| Encounter
	| Condition
	| Observation
	| MedicationRequest
	| AllergyIntolerance;

// --- Bundle ---

export type FHIRBundleType = "collection" | "transaction";

export interface BundleEntryRequest {
	method: "POST";
	url: FHIRResource["resourceType"];
}

// `entry.request` is mandatory for transaction bundles and prohibited
// otherwise (R4 Bundle rules), so each bundle type gets its own entry shape.

export interface CollectionBundleEntry {
	fullUrl: string;
	resource: FHIRResource;
	request?: never;
}

export interface TransactionBundleEntry {
	fullUrl: string;
	resource: FHIRResource;
	request: BundleEntryRequest;
}

interface BundleBase {
	resourceType: "Bundle";
	id: string;
}

export type Bundle =
	| (BundleBase & { type: "collection"; entry: CollectionBundleEntry[] })
	| (BundleBase & { type: "transaction"; entry: TransactionBundleEntry[] });
