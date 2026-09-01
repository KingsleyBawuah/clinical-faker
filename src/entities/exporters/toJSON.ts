import type { PatientGraph } from "../types.ts";
import { projectVitals, type VitalsSummary } from "../vitalsProjection.ts";

export interface PatientJSON extends PatientGraph {
	vitals: VitalsSummary;
}

/**
 * The canonical IR (`PatientGraph`) is already shaped the way `.toJSON()`
 * should look — this only adds the computed vitals projection on top.
 */
export function toJSON(patient: PatientGraph): PatientJSON {
	return {
		...patient,
		vitals: projectVitals(patient.observations),
	};
}
