import type { Gender } from "../entities/types.ts";

/** A condition an archetype can produce, coded in ICD-10-CM. */
export interface ConditionSpec {
	readonly code: string;
	readonly display: string;
	/** Chance the condition is generated: 1.0 = primary, <1.0 = comorbidity. */
	readonly probability: number;
}

/** A numeric observation sampled from a Gaussian, coded in LOINC with a UCUM unit. */
export interface ObservationDistributionSpec {
	readonly loincCode: string;
	readonly display: string;
	readonly unit: string;
	readonly mean: number;
	readonly stdDev: number;
	/** Physically possible bounds — distinct from `referenceRange`; samples outside it are impossible, not just abnormal. */
	readonly clamp: { readonly min: number; readonly max: number };
	/** The clinically normal range; drives `ObservationEntity.abnormalFlag`. */
	readonly referenceRange: { readonly low: number; readonly high: number };
}

/** A medication an archetype can prescribe, coded in RxNorm. */
export interface MedicationSpec {
	readonly name: string;
	readonly rxcui: string;
	readonly sig: string;
	readonly probability: number;
	/** ICD-10-CM code; when set, the medication only appears if that condition was generated. */
	readonly forCondition?: string;
}

/** Limits on the demographics an archetype can be paired with — see docs/architecture.md's "Demographic plausibility". */
export interface DemographicConstraints {
	readonly minAge?: number;
	readonly maxAge?: number;
	readonly compatibleGenders?: readonly Gender[];
}

/** Everything needed to generate one archetype's clinical data. */
export interface ArchetypeDefinition {
	readonly conditions: readonly ConditionSpec[];
	readonly observations: readonly ObservationDistributionSpec[];
	readonly medications: readonly MedicationSpec[];
	readonly demographicConstraints?: DemographicConstraints;
}
