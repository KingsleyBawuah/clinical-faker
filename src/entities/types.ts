/** HL7 CX / FHIR Identifier — every id in this domain needs an assigning authority, not just a bare string. */
export interface Identifier {
	value: string;
	assigningAuthority: string;
}

/** HL7 XAD / FHIR Address. */
export interface Address {
	line: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
}

/** HL7 XCN / FHIR Practitioner reference. */
export interface Provider {
	identifier: Identifier;
	firstName: string;
	lastName: string;
}

/** Matches FHIR `Patient.gender` directly. Biological/birth sex is a separate, not-yet-modeled US Core extension. */
export type Gender = "male" | "female" | "other" | "unknown";

export interface Demographics {
	firstName: string;
	lastName: string;
	/** Derived from `age` relative to the patient's `referenceDate` — never sampled independently. */
	dob: string;
	age: number;
	gender: Gender;
	mrn: Identifier;
	address: Address;
}

/** HL7 PV1-2 / FHIR Encounter.class. */
export type EncounterClass = "inpatient" | "outpatient" | "emergency";

export interface Encounter {
	id: string;
	class: EncounterClass;
	/** HL7 PV1-44 / FHIR Encounter.period. */
	period: { start: string; end?: string };
	/** HL7 PV1-3 point of care / facility display name. */
	location?: string;
	/** HL7 PV1-7; reused as admitting (PV1-17) and ordering (ORC-12/OBR-16) provider — a deliberate MVP simplification. */
	attendingProvider: Provider;
}

export type ConditionRank = "primary" | "secondary";

export interface ConditionEntity {
	code: string;
	display: string;
	onsetDate?: string;
	/** Derived from the archetype's `ConditionSpec.probability` (1.0 = primary, <1.0 = comorbidity). */
	rank: ConditionRank;
}

/** HL7 OBX-8 / FHIR Observation.interpretation — always derived from `value` vs `referenceRange`, never independently generated. */
export type AbnormalFlag = "H" | "L" | "N";

export interface ObservationEntity {
	loincCode: string;
	display: string;
	value: number | string;
	unit?: string;
	/** HL7 OBX-14 / FHIR Observation.effectiveDateTime. */
	effectiveDateTime: string;
	/** HL7 OBX-7 / FHIR Observation.referenceRange — the clinically normal range, used to derive `abnormalFlag`. */
	referenceRange?: { low: number; high: number };
	abnormalFlag?: AbnormalFlag;
}

/** Combined `{ name, rxcui, sig }` shape matches how RxNorm itself models a specific strength+form as one concept. */
export interface MedicationEntity {
	name: string;
	rxcui: string;
	sig: string;
}

export type AllergyCriticality = "low" | "high" | "unable-to-assess";

export interface AllergyEntity {
	substance: string;
	reaction?: string;
	criticality?: AllergyCriticality;
}

export interface PatientGraph {
	id: string;
	seed: number;
	/** ISO date (`YYYY-MM-DD`); anchors all encounter/observation timestamps. Deterministic — never wall-clock "now". */
	referenceDate: string;
	demographics: Demographics;
	archetype?: string;
	encounters: Encounter[];
	conditions: ConditionEntity[];
	observations: ObservationEntity[];
	medications: MedicationEntity[];
	allergies: AllergyEntity[];
}
