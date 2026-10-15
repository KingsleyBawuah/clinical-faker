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

export interface CodeableConcept {
	coding?: Coding[];
	text?: string;
}

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

export interface Encounter {
	resourceType: "Encounter";
	id: string;
	/** `finished` when `period.end` exists, else `in-progress`. */
	status: "finished" | "in-progress";
	/** R4's `Encounter.class` is a single `Coding` (1..1), not a `CodeableConcept`. */
	class: Coding;
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

export interface ObservationComponent {
	code: CodeableConcept;
	valueQuantity?: Quantity;
	dataAbsentReason?: CodeableConcept;
}

export interface Observation {
	resourceType: "Observation";
	id: string;
	meta?: Meta;
	status: "final";
	category: CodeableConcept[];
	code: CodeableConcept;
	subject: Reference;
	encounter: Reference;
	effectiveDateTime: string;
	valueQuantity?: Quantity;
	valueString?: string;
	dataAbsentReason?: CodeableConcept;
	interpretation?: CodeableConcept[];
	referenceRange?: ObservationReferenceRange[];
	component?: ObservationComponent[];
}

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

export interface BundleEntry {
	fullUrl: string;
	resource: FHIRResource;
	/** Present on every `transaction` entry; prohibited on `collection`. */
	request?: BundleEntryRequest;
}

export interface Bundle {
	resourceType: "Bundle";
	id: string;
	type: FHIRBundleType;
	entry: BundleEntry[];
}
