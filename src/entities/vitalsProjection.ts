import type { ObservationEntity } from "./types.ts";

export interface VitalsSummary {
	systolicBp?: number;
	diastolicBp?: number;
	heartRate?: number;
	temperature?: number;
	respiratoryRate?: number;
	spo2?: number;
}

// Verified live against the NLM Clinical Table Search Service
// (clinicaltables.nlm.nih.gov/api/loinc_items) rather than trusted from
// memory — see docs/architecture.md's "Ontology data-accuracy verification".
export const SYSTOLIC_BP_LOINC = "8480-6"; // Systolic blood pressure
export const DIASTOLIC_BP_LOINC = "8462-4"; // Diastolic blood pressure
export const SPO2_LOINC = "59408-5"; // Oxygen saturation in Arterial blood by Pulse oximetry

const VITAL_SIGN_LOINC_CODES: Readonly<Record<string, keyof VitalsSummary>> = {
	[SYSTOLIC_BP_LOINC]: "systolicBp",
	[DIASTOLIC_BP_LOINC]: "diastolicBp",
	"8867-4": "heartRate", // Heart rate
	"8310-5": "temperature", // Body temperature
	"9279-1": "respiratoryRate", // Respiratory rate
	[SPO2_LOINC]: "spo2",
};

/** Whether a LOINC code is one of the vital signs this library generates. */
export function isVitalSignLoincCode(loincCode: string): boolean {
	return Object.hasOwn(VITAL_SIGN_LOINC_CODES, loincCode);
}

/**
 * Projects well-known vital-sign LOINC codes out of the generic
 * `observations` array into a friendly summary. `observations` stays the
 * single source of truth (it also carries lab-style values that aren't
 * vitals); this is purely an additive convenience view for `.toJSON()`.
 *
 * When more than one observation shares a vital-sign code (repeated
 * readings across an encounter), the one with the latest `effectiveDateTime`
 * wins — not whichever happens to appear last in the array.
 */
export function projectVitals(
	observations: readonly ObservationEntity[],
): VitalsSummary {
	const latestByKey = new Map<
		keyof VitalsSummary,
		{ value: number; effectiveDateTime: string }
	>();

	for (const observation of observations) {
		const key = VITAL_SIGN_LOINC_CODES[observation.loincCode];
		if (key === undefined || typeof observation.value !== "number") {
			continue;
		}
		const existing = latestByKey.get(key);
		if (
			!existing ||
			observation.effectiveDateTime > existing.effectiveDateTime
		) {
			latestByKey.set(key, {
				value: observation.value,
				effectiveDateTime: observation.effectiveDateTime,
			});
		}
	}

	const vitals: VitalsSummary = {};
	for (const [key, entry] of latestByKey) {
		vitals[key] = entry.value;
	}
	return vitals;
}
