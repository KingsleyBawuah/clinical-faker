import type {
	Encounter as IREncounter,
	ObservationEntity,
} from "../../entities/types.ts";
import {
	DIASTOLIC_BP_LOINC,
	isVitalSignLoincCode,
	SPO2_LOINC,
	SYSTOLIC_BP_LOINC,
} from "../../entities/vitalsProjection.ts";
import { codeableConcept, coding, reference } from "../datatypes.ts";
import {
	BP_PROFILE,
	DATA_ABSENT_REASON_SYSTEM,
	LOINC_SYSTEM,
	OBSERVATION_CATEGORY_SYSTEM,
	OBSERVATION_INTERPRETATION_SYSTEM,
	OXYGEN_SATURATION_PROFILE,
	UCUM_SYSTEM,
	VITAL_SIGNS_PROFILE,
} from "../systems.ts";
import type {
	CodeableConcept,
	Observation,
	ObservationBase,
	ObservationComponent,
	ObservationInterpretationAndRange,
	Quantity,
} from "../types.ts";

// LOINC codes and displays verified against the NLM Clinical Table Search
// Service, like vitalsProjection.ts's vital-sign codes.
const BP_PANEL_CODING = coding(
	LOINC_SYSTEM,
	"85354-9",
	"Blood pressure panel with all children optional",
);
const BP_COMPONENTS = {
	systolic: { code: SYSTOLIC_BP_LOINC, display: "Systolic blood pressure" },
	diastolic: { code: DIASTOLIC_BP_LOINC, display: "Diastolic blood pressure" },
} as const;
/** The code R4's oxygen-saturation profile is keyed on; added alongside the IR's more specific pulse-oximetry code. */
const OXYGEN_SATURATION_CODING = coding(
	LOINC_SYSTEM,
	"2708-6",
	"Oxygen saturation in Arterial blood",
);

type BPSide = keyof typeof BP_COMPONENTS;
type ObservationCategoryCode = "vital-signs" | "laboratory";

/** What every Observation for an encounter references: its patient, encounter, and performer (the attending provider). */
interface ObservationContext {
	patientId: string;
	encounterId: string;
	performerId: string;
}

interface IndexedReading {
	observation: ObservationEntity;
	/** Position in the input, so output order follows it. */
	index: number;
}

function bpSide(loincCode: string): BPSide | undefined {
	if (loincCode === SYSTOLIC_BP_LOINC) return "systolic";
	if (loincCode === DIASTOLIC_BP_LOINC) return "diastolic";
	return undefined;
}

/** Groups readings by the instant they were taken, not the string, so the same time written with different UTC offsets pairs. */
function instantKey(dateTime: string): string {
	const epochMs = Date.parse(dateTime);
	return Number.isNaN(epochMs) ? dateTime : String(epochMs);
}

/**
 * Builds every `Observation` for a patient's observations, all attached to
 * one encounter and performed by its attending provider. Blood-pressure
 * readings are paired into `85354-9` panels — see docs/architecture.md's
 * "Blood pressure is a panel in FHIR": at each instant, the nth systolic
 * pairs with the nth diastolic, in input order. A panel takes the id of
 * whichever of its readings comes first and sits at that reading's position;
 * the other reading's IR id isn't emitted.
 */
export function buildObservations(
	observations: readonly ObservationEntity[],
	patientId: string,
	encounter: IREncounter,
): Observation[] {
	const context: ObservationContext = {
		patientId,
		encounterId: encounter.id,
		performerId: encounter.attendingProvider.id,
	};
	const built: { index: number; resource: Observation }[] = [];
	const bpByInstant = new Map<string, Record<BPSide, IndexedReading[]>>();

	observations.forEach((observation, index) => {
		const side = bpSide(observation.loincCode);
		if (side === undefined) {
			built.push({ index, resource: buildObservation(observation, context) });
			return;
		}
		const key = instantKey(observation.effectiveDateTime);
		const group = bpByInstant.get(key) ?? { systolic: [], diastolic: [] };
		group[side].push({ observation, index });
		bpByInstant.set(key, group);
	});

	for (const group of bpByInstant.values()) {
		const pairs = Math.max(group.systolic.length, group.diastolic.length);
		for (let pair = 0; pair < pairs; pair++) {
			const systolic = group.systolic[pair];
			const diastolic = group.diastolic[pair];
			const first =
				diastolic !== undefined &&
				(systolic === undefined || diastolic.index < systolic.index)
					? diastolic
					: systolic;
			if (first === undefined) continue;
			built.push({
				index: first.index,
				resource: buildBPPanel(
					first.observation,
					systolic?.observation,
					diastolic?.observation,
					context,
				),
			});
		}
	}

	return built
		.sort((a, b) => a.index - b.index)
		.map(({ resource }) => resource);
}

function buildObservation(
	observation: ObservationEntity,
	context: ObservationContext,
): Observation {
	const isVitalSign = isVitalSignLoincCode(observation.loincCode);
	const base = observationBase(
		observation,
		observationCode(observation),
		isVitalSign ? "vital-signs" : "laboratory",
		context,
	);
	const details = interpretationAndRange(observation);
	if (typeof observation.value !== "number") {
		return { ...base, ...details, valueString: observation.value };
	}
	const resource: Observation = {
		...base,
		...details,
		valueQuantity: quantity(observation.value, observation.unit),
	};
	// The vital-signs profile requires a UCUM-coded quantity, so only a
	// numeric reading with a unit claims it.
	if (isVitalSign && observation.unit !== undefined) {
		resource.meta = {
			profile:
				observation.loincCode === SPO2_LOINC
					? [VITAL_SIGNS_PROFILE, OXYGEN_SATURATION_PROFILE]
					: [VITAL_SIGNS_PROFILE],
		};
	}
	return resource;
}

function observationCode(observation: ObservationEntity): CodeableConcept {
	const primary = coding(
		LOINC_SYSTEM,
		observation.loincCode,
		observation.display,
	);
	return observation.loincCode === SPO2_LOINC
		? { coding: [primary, OXYGEN_SATURATION_CODING] }
		: codeableConcept(primary);
}

function buildBPPanel(
	first: ObservationEntity,
	systolic: ObservationEntity | undefined,
	diastolic: ObservationEntity | undefined,
	context: ObservationContext,
): Observation {
	return {
		...observationBase(
			first,
			codeableConcept(BP_PANEL_CODING),
			"vital-signs",
			context,
		),
		meta: { profile: [VITAL_SIGNS_PROFILE, BP_PROFILE] },
		component: [
			bpComponent("systolic", systolic),
			bpComponent("diastolic", diastolic),
		],
	};
}

function bpComponent(
	side: BPSide,
	reading: ObservationEntity | undefined,
): ObservationComponent {
	const { code, display } = BP_COMPONENTS[side];
	if (reading === undefined) {
		return {
			code: codeableConcept(coding(LOINC_SYSTEM, code, display)),
			dataAbsentReason: codeableConcept(
				coding(DATA_ABSENT_REASON_SYSTEM, "unknown"),
			),
		};
	}
	const componentCode = codeableConcept(
		coding(LOINC_SYSTEM, code, reading.display),
	);
	const details = interpretationAndRange(reading);
	return typeof reading.value === "number"
		? {
				code: componentCode,
				...details,
				valueQuantity: quantity(reading.value, reading.unit),
			}
		: {
				code: componentCode,
				...details,
				// The bp profile only allows a Quantity here, so a free-text reading is kept as the reason's text.
				dataAbsentReason: {
					coding: [coding(DATA_ABSENT_REASON_SYSTEM, "as-text")],
					text: reading.value,
				},
			};
}

function observationBase(
	observation: ObservationEntity,
	code: CodeableConcept,
	category: ObservationCategoryCode,
	context: ObservationContext,
): ObservationBase {
	return {
		resourceType: "Observation",
		id: observation.id,
		status: "final",
		category: [codeableConcept(coding(OBSERVATION_CATEGORY_SYSTEM, category))],
		code,
		subject: reference(context.patientId),
		encounter: reference(context.encounterId),
		effectiveDateTime: observation.effectiveDateTime,
		performer: [reference(context.performerId)],
	};
}

/** UCUM-coded when the IR has a unit: the IR's units are UCUM codes, so `unit` and `code` match. */
function quantity(value: number, unit: string | undefined): Quantity {
	return unit === undefined
		? { value }
		: { value, unit, system: UCUM_SYSTEM, code: unit };
}

function interpretationAndRange(
	observation: ObservationEntity,
): ObservationInterpretationAndRange {
	const details: ObservationInterpretationAndRange = {};
	if (observation.abnormalFlag !== undefined) {
		details.interpretation = [
			codeableConcept(
				coding(OBSERVATION_INTERPRETATION_SYSTEM, observation.abnormalFlag),
			),
		];
	}
	if (observation.referenceRange !== undefined) {
		details.referenceRange = [
			{
				low: quantity(observation.referenceRange.low, observation.unit),
				high: quantity(observation.referenceRange.high, observation.unit),
			},
		];
	}
	return details;
}
