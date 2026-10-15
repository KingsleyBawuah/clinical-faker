import type { ObservationEntity } from "../../entities/types.ts";
import { isVitalSignLoincCode } from "../../entities/vitalsProjection.ts";
import { codeableConcept, coding, reference } from "../datatypes.ts";
import {
	DATA_ABSENT_REASON_SYSTEM,
	LOINC_SYSTEM,
	OBSERVATION_CATEGORY_SYSTEM,
	OBSERVATION_INTERPRETATION_SYSTEM,
	UCUM_SYSTEM,
	VITAL_SIGNS_PROFILE,
} from "../systems.ts";
import type {
	CodeableConcept,
	Observation,
	ObservationBase,
	ObservationComponent,
	ObservationReferenceRange,
	Quantity,
} from "../types.ts";

// LOINC codes and displays verified against the NLM Clinical Table Search
// Service, like vitalsProjection.ts's vital-sign codes.
const BP_PANEL_CODE = "85354-9";
const BP_PANEL_DISPLAY = "Blood pressure panel with all children optional";
const BP_COMPONENTS = {
	systolic: { code: "8480-6", display: "Systolic blood pressure" },
	diastolic: { code: "8462-4", display: "Diastolic blood pressure" },
} as const;
type BPSide = keyof typeof BP_COMPONENTS;

/** Systolic and diastolic readings sharing an `effectiveDateTime`, compiled into one panel. `first` supplies the panel's id. */
interface BPPanel {
	first: ObservationEntity;
	systolic?: ObservationEntity;
	diastolic?: ObservationEntity;
}

function bpSide(loincCode: string): BPSide | undefined {
	if (loincCode === BP_COMPONENTS.systolic.code) return "systolic";
	if (loincCode === BP_COMPONENTS.diastolic.code) return "diastolic";
	return undefined;
}

/**
 * Builds every `Observation` for a patient's observations. Blood-pressure
 * readings are paired into `85354-9` panels — see docs/architecture.md's
 * "Blood pressure is a panel in FHIR". A panel takes the id of whichever of
 * its readings comes first, and sits at that reading's position; the other
 * reading's IR id isn't emitted. A second reading for a side that's already
 * filled at the same time starts a new panel rather than overwriting.
 */
export function buildObservations(
	observations: readonly ObservationEntity[],
	patientId: string,
	encounterId: string,
): Observation[] {
	const slots: (ObservationEntity | BPPanel)[] = [];
	const openPanels = new Map<string, BPPanel>();

	for (const observation of observations) {
		const side = bpSide(observation.loincCode);
		if (side === undefined) {
			slots.push(observation);
			continue;
		}
		const open = openPanels.get(observation.effectiveDateTime);
		if (open !== undefined && open[side] === undefined) {
			open[side] = observation;
			continue;
		}
		const panel: BPPanel = { first: observation, [side]: observation };
		slots.push(panel);
		openPanels.set(observation.effectiveDateTime, panel);
	}

	return slots.map((slot) =>
		"first" in slot
			? buildBPPanel(slot, patientId, encounterId)
			: buildObservation(slot, patientId, encounterId),
	);
}

function buildObservation(
	observation: ObservationEntity,
	patientId: string,
	encounterId: string,
): Observation {
	const base = observationBase(
		observation,
		coding(LOINC_SYSTEM, observation.loincCode, observation.display),
		isVitalSignLoincCode(observation.loincCode),
		patientId,
		encounterId,
	);
	const resource: Observation =
		typeof observation.value === "number"
			? {
					...base,
					valueQuantity: quantity(observation.value, observation.unit),
				}
			: { ...base, valueString: observation.value };
	Object.assign(resource, interpretationAndRange(observation));
	return resource;
}

function buildBPPanel(
	panel: BPPanel,
	patientId: string,
	encounterId: string,
): Observation {
	return {
		...observationBase(
			panel.first,
			coding(LOINC_SYSTEM, BP_PANEL_CODE, BP_PANEL_DISPLAY),
			true,
			patientId,
			encounterId,
		),
		component: [
			bpComponent("systolic", panel.systolic),
			bpComponent("diastolic", panel.diastolic),
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
	const component: ObservationComponent =
		typeof reading.value === "number"
			? {
					code: componentCode,
					valueQuantity: quantity(reading.value, reading.unit),
				}
			: {
					code: componentCode,
					// The bp profile only allows a Quantity here, so a free-text reading is kept as the reason's text.
					dataAbsentReason: {
						coding: [coding(DATA_ABSENT_REASON_SYSTEM, "as-text")],
						text: reading.value,
					},
				};
	return { ...component, ...interpretationAndRange(reading) };
}

function observationBase(
	observation: ObservationEntity,
	code: ReturnType<typeof coding>,
	isVitalSign: boolean,
	patientId: string,
	encounterId: string,
): ObservationBase {
	const base: ObservationBase = {
		resourceType: "Observation",
		id: observation.id,
		status: "final",
		category: [
			codeableConcept(
				coding(
					OBSERVATION_CATEGORY_SYSTEM,
					isVitalSign ? "vital-signs" : "laboratory",
				),
			),
		],
		code: codeableConcept(code),
		subject: reference(patientId),
		encounter: reference(encounterId),
		effectiveDateTime: observation.effectiveDateTime,
	};
	if (isVitalSign) {
		base.meta = { profile: [VITAL_SIGNS_PROFILE] };
	}
	return base;
}

/** UCUM-coded when the IR has a unit: the IR's units are UCUM codes, so `unit` and `code` match. */
function quantity(value: number, unit: string | undefined): Quantity {
	return unit === undefined
		? { value }
		: { value, unit, system: UCUM_SYSTEM, code: unit };
}

function interpretationAndRange(observation: ObservationEntity): {
	interpretation?: CodeableConcept[];
	referenceRange?: ObservationReferenceRange[];
} {
	const fields: {
		interpretation?: CodeableConcept[];
		referenceRange?: ObservationReferenceRange[];
	} = {};
	if (observation.abnormalFlag !== undefined) {
		fields.interpretation = [
			codeableConcept(
				coding(OBSERVATION_INTERPRETATION_SYSTEM, observation.abnormalFlag),
			),
		];
	}
	if (observation.referenceRange !== undefined) {
		fields.referenceRange = [
			{
				low: quantity(observation.referenceRange.low, observation.unit),
				high: quantity(observation.referenceRange.high, observation.unit),
			},
		];
	}
	return fields;
}
