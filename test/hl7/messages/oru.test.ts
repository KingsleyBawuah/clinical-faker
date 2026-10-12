import { describe, expect, test } from "bun:test";
import { createMulberry32 } from "../../../src/core/prng/mulberry32.ts";
import type { PatientGraph } from "../../../src/entities/types.ts";
import { buildORUMessage } from "../../../src/hl7/messages/oru.ts";

const BASE_PATIENT: PatientGraph = {
	id: "pat-1",
	seed: 42,
	referenceDate: "2024-01-01",
	demographics: {
		firstName: "John",
		lastName: "Doe",
		dob: "1958-04-12",
		age: 65,
		gender: "male",
		mrn: { value: "MRN00042", assigningAuthority: "clinical-faker" },
		address: {
			line: "742 Evergreen Terrace",
			city: "Springfield",
			state: "IL",
			postalCode: "62704",
			country: "US",
		},
	},
	encounters: [
		{
			id: "enc-1",
			class: "inpatient",
			period: { start: "2024-03-05T14:30:07.000Z" },
			attendingProvider: {
				identifier: { value: "1234567893", assigningAuthority: "NPI" },
				firstName: "Jane",
				lastName: "Baker",
			},
		},
	],
	conditions: [],
	observations: [
		{
			loincCode: "8480-6",
			display: "Systolic blood pressure",
			value: 152,
			unit: "mm[Hg]",
			effectiveDateTime: "2024-03-05T15:00:00.000Z",
			referenceRange: { low: 90, high: 120 },
			abnormalFlag: "H",
		},
		{
			loincCode: "8867-4",
			display: "Heart rate",
			value: 72,
			unit: "/min",
			effectiveDateTime: "2024-03-05T15:00:00.000Z",
		},
	],
	medications: [],
	allergies: [],
};

function segmentIds(patient: PatientGraph): string[] {
	return buildORUMessage(patient, createMulberry32(1)).map(
		(segment) => segment[0],
	);
}

describe("buildORUMessage", () => {
	test("produces MSH, PID, PV1, ORC, OBR, then one OBX per observation", () => {
		expect(segmentIds(BASE_PATIENT)).toEqual([
			"MSH",
			"PID",
			"PV1",
			"ORC",
			"OBR",
			"OBX",
			"OBX",
		]);
	});

	test("composes MSH-9 as ORU^R01^ORU_R01", () => {
		const [msh] = buildORUMessage(BASE_PATIENT, createMulberry32(1));
		expect(msh?.[9]).toEqual([["ORU", "R01", "ORU_R01"]]);
	});

	test("produces a valid message with ORC + OBR and zero OBX when the patient has no observations", () => {
		expect(segmentIds({ ...BASE_PATIENT, observations: [] })).toEqual([
			"MSH",
			"PID",
			"PV1",
			"ORC",
			"OBR",
		]);
	});

	test("omits PV1 and the ordering provider when the patient has no encounters", () => {
		const patient: PatientGraph = { ...BASE_PATIENT, encounters: [] };
		const message = buildORUMessage(patient, createMulberry32(1));
		expect(message.map((segment) => segment[0])).toEqual([
			"MSH",
			"PID",
			"ORC",
			"OBR",
			"OBX",
			"OBX",
		]);
		const obr = message.find((segment) => segment[0] === "OBR");
		expect(obr?.[16]).toBe(""); // OBR-16 Ordering Provider
	});

	test("shares one placer/filler order number pair between ORC and OBR, with placer and filler distinct", () => {
		const message = buildORUMessage(BASE_PATIENT, createMulberry32(1));
		const orc = message.find((segment) => segment[0] === "ORC");
		const obr = message.find((segment) => segment[0] === "OBR");
		expect(orc?.[2]).toBe(obr?.[2]);
		expect(orc?.[3]).toBe(obr?.[3]);
		expect(orc?.[2]).not.toBe(orc?.[3]);
		expect(orc?.[2]).toMatch(/^[0-9a-f]{16}$/);
	});

	test("is deterministic for the same PRNG seed", () => {
		expect(buildORUMessage(BASE_PATIENT, createMulberry32(1))).toEqual(
			buildORUMessage(BASE_PATIENT, createMulberry32(1)),
		);
	});
});
