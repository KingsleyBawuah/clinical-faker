import { describe, expect, test } from "bun:test";
import { createMulberry32 } from "../../../src/core/prng/mulberry32.ts";
import type { PatientGraph } from "../../../src/entities/types.ts";
import { buildORMMessage } from "../../../src/hl7/messages/orm.ts";
import type { HL7Segment } from "../../../src/hl7/types.ts";

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
				id: "provider-1",
				identifier: { value: "1234567893", assigningAuthority: "NPI" },
				firstName: "Jane",
				lastName: "Baker",
			},
		},
	],
	conditions: [],
	observations: [
		{
			id: "observation-1",
			loincCode: "8480-6",
			display: "Systolic blood pressure",
			value: 152,
			unit: "mm[Hg]",
			effectiveDateTime: "2024-03-05T15:00:00.000Z",
		},
	],
	medications: [],
	allergies: [],
};

/** Finds the ORC and OBR segments, failing the test outright if either is missing. */
function orderSegments(patient: PatientGraph): {
	orc: HL7Segment;
	obr: HL7Segment;
} {
	const message = buildORMMessage(patient, createMulberry32(1));
	const orc = message.find((segment) => segment[0] === "ORC");
	const obr = message.find((segment) => segment[0] === "OBR");
	if (orc === undefined || obr === undefined) {
		throw new Error("expected ORC and OBR segments in ORM^O01");
	}
	return { orc, obr };
}

describe("buildORMMessage", () => {
	test("produces MSH, PID, PV1, ORC, OBR with no OBX even when observations exist", () => {
		const message = buildORMMessage(BASE_PATIENT, createMulberry32(1));
		expect(message.map((segment) => segment[0])).toEqual([
			"MSH",
			"PID",
			"PV1",
			"ORC",
			"OBR",
		]);
	});

	test("composes MSH-9 as ORM^O01^ORM_O01", () => {
		const [msh] = buildORMMessage(BASE_PATIENT, createMulberry32(1));
		expect(msh?.[9]).toEqual([["ORM", "O01", "ORM_O01"]]);
	});

	test("uses ORC-1 NW (new order) and leaves result-only OBR fields empty", () => {
		const { orc, obr } = orderSegments(BASE_PATIENT);
		expect(orc[1]).toBe("NW");
		// Builders trim trailing empty fields, so an unset field reads as undefined.
		expect(obr[7] ?? "").toBe(""); // OBR-7 Observation Date/Time
		expect(obr[25] ?? "").toBe(""); // OBR-25 Result Status
	});

	test("carries the placer order number but leaves the filler order number for the filler to assign", () => {
		const { orc, obr } = orderSegments(BASE_PATIENT);
		expect(orc[2]).toMatch(/^[0-9a-f]{16}$/);
		expect(obr[2]).toBe(orc[2]);
		expect(orc[3]).toBe(""); // ORC-3 Filler Order Number
		expect(obr[3]).toBe(""); // OBR-3 Filler Order Number
	});

	test("omits PV1 and the ordering provider when the patient has no encounters", () => {
		const patient: PatientGraph = { ...BASE_PATIENT, encounters: [] };
		const message = buildORMMessage(patient, createMulberry32(1));
		expect(message.map((segment) => segment[0])).toEqual([
			"MSH",
			"PID",
			"ORC",
			"OBR",
		]);
		const { orc } = orderSegments(patient);
		expect(orc[12] ?? "").toBe(""); // ORC-12 Ordering Provider
	});

	test("is deterministic for the same PRNG seed", () => {
		expect(buildORMMessage(BASE_PATIENT, createMulberry32(1))).toEqual(
			buildORMMessage(BASE_PATIENT, createMulberry32(1)),
		);
	});
});
