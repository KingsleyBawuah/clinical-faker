import {
	DIASTOLIC_BP_LOINC,
	SYSTOLIC_BP_LOINC,
} from "../entities/vitalsProjection.ts";
import type { ArchetypeDefinition } from "./types.ts";

// Every code and display below was checked live on 2026-10-15 against free
// NLM sources — see docs/architecture.md's "Ontology data-accuracy verification":
// - ICD-10-CM: clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code&terms=<code>
//   I10 "Essential (primary) hypertension"; E78.5 "Hyperlipidemia, unspecified".
// - LOINC: clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?type=question&sf=LOINC_NUM&terms=<code>
//   (displays are LONG_COMMON_NAME; no EXTERNAL_COPYRIGHT_NOTICE on any of them)
//   8480-6 "Systolic blood pressure"; 8462-4 "Diastolic blood pressure";
//   8867-4 "Heart rate"; 2823-3 "Potassium [Moles/volume] in Serum or Plasma";
//   2160-0 "Creatinine [Mass/volume] in Serum or Plasma".
// - RxNorm: rxnav.nlm.nih.gov/REST/rxcui/<rxcui>/properties.json (tty SCD) and
//   .../historystatus.json (status Active); names are the SAB=RXNORM normalized names.
//   314076 lisinopril 10 MG; 197361 amlodipine 5 MG; 310798 hydrochlorothiazide 25 MG;
//   617310 atorvastatin 20 MG (all Oral Tablet).
//
// Reference ranges are typical adult normals; clamps are physically possible
// bounds the sampler resamples within, not clinical limits.

const HYPERTENSION = "I10";
const HYPERLIPIDEMIA = "E78.5";
const ONCE_DAILY = "Take 1 tablet by mouth once daily";

/** Essential hypertension in an adult, with hyperlipidemia as a common comorbidity. */
export const AdultHypertension = {
	conditions: [
		{
			code: HYPERTENSION,
			display: "Essential (primary) hypertension",
			probability: 1,
		},
		{
			code: HYPERLIPIDEMIA,
			display: "Hyperlipidemia, unspecified",
			probability: 0.5,
		},
	],
	observations: [
		{
			loincCode: SYSTOLIC_BP_LOINC,
			display: "Systolic blood pressure",
			unit: "mm[Hg]",
			mean: 146,
			stdDev: 12,
			clamp: { min: 60, max: 260 },
			referenceRange: { low: 90, high: 120 },
		},
		{
			loincCode: DIASTOLIC_BP_LOINC,
			display: "Diastolic blood pressure",
			unit: "mm[Hg]",
			mean: 92,
			stdDev: 8,
			clamp: { min: 30, max: 160 },
			referenceRange: { low: 60, high: 80 },
		},
		{
			loincCode: "8867-4",
			display: "Heart rate",
			unit: "/min",
			mean: 76,
			stdDev: 10,
			clamp: { min: 25, max: 220 },
			referenceRange: { low: 60, high: 100 },
		},
		{
			loincCode: "2823-3",
			display: "Potassium [Moles/volume] in Serum or Plasma",
			unit: "mmol/L",
			mean: 4.2,
			stdDev: 0.4,
			clamp: { min: 1.5, max: 9 },
			referenceRange: { low: 3.5, high: 5.1 },
		},
		{
			loincCode: "2160-0",
			display: "Creatinine [Mass/volume] in Serum or Plasma",
			unit: "mg/dL",
			mean: 1,
			stdDev: 0.2,
			clamp: { min: 0.2, max: 15 },
			referenceRange: { low: 0.6, high: 1.3 },
		},
	],
	medications: [
		{
			name: "lisinopril 10 MG Oral Tablet",
			rxcui: "314076",
			sig: ONCE_DAILY,
			probability: 0.5,
			forCondition: HYPERTENSION,
		},
		{
			name: "amlodipine 5 MG Oral Tablet",
			rxcui: "197361",
			sig: ONCE_DAILY,
			probability: 0.4,
			forCondition: HYPERTENSION,
		},
		{
			name: "hydrochlorothiazide 25 MG Oral Tablet",
			rxcui: "310798",
			sig: ONCE_DAILY,
			probability: 0.3,
			forCondition: HYPERTENSION,
		},
		{
			name: "atorvastatin 20 MG Oral Tablet",
			rxcui: "617310",
			sig: ONCE_DAILY,
			probability: 0.7,
			forCondition: HYPERLIPIDEMIA,
		},
	],
} as const satisfies ArchetypeDefinition;
