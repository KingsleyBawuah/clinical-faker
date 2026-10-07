import { describe, expect, test } from "bun:test";
import { createMulberry32 } from "../../../src/core/prng/mulberry32.ts";
import type { PatientGraph } from "../../../src/entities/types.ts";
import { buildADTMessage } from "../../../src/hl7/messages/adt.ts";
import { serializeMessage } from "../../../src/hl7/serializeMessage.ts";

function segmentIds(
	patient: PatientGraph,
	eventType: "A01" | "A08" = "A01",
): string[] {
	const message = buildADTMessage(patient, eventType, createMulberry32(1));
	return message.map((segment) => segment[0]);
}

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
	observations: [],
	medications: [],
	allergies: [],
};

describe("buildADTMessage", () => {
	test("produces MSH, EVN, PID, PV1 in order when the patient has an encounter", () => {
		expect(segmentIds(BASE_PATIENT)).toEqual(["MSH", "EVN", "PID", "PV1"]);
	});

	test("omits PV1 when the patient has no encounters", () => {
		const patient: PatientGraph = { ...BASE_PATIENT, encounters: [] };
		expect(segmentIds(patient)).toEqual(["MSH", "EVN", "PID"]);
	});

	test("appends one DG1 per condition and one AL1 per allergy, with 1-based Set IDs", () => {
		const patient: PatientGraph = {
			...BASE_PATIENT,
			conditions: [
				{ code: "I10", display: "Essential hypertension", rank: "primary" },
				{
					code: "E78.5",
					display: "Hyperlipidemia, unspecified",
					rank: "secondary",
				},
			],
			allergies: [{ substance: "Penicillin", criticality: "high" }],
		};
		const message = buildADTMessage(patient, "A01", createMulberry32(1));
		expect(segmentIds(patient)).toEqual([
			"MSH",
			"EVN",
			"PID",
			"PV1",
			"DG1",
			"DG1",
			"AL1",
		]);

		const dg1Segments = message.filter((segment) => segment[0] === "DG1");
		expect(dg1Segments[0]?.[1]).toBe("1");
		expect(dg1Segments[1]?.[1]).toBe("2");
		const al1Segments = message.filter((segment) => segment[0] === "AL1");
		expect(al1Segments[0]?.[1]).toBe("1");
	});

	test("both A01 and A08 compose MSH-9 with the shared ADT_A01 message structure", () => {
		const [a01Msh] = buildADTMessage(BASE_PATIENT, "A01", createMulberry32(1));
		const [a08Msh] = buildADTMessage(BASE_PATIENT, "A08", createMulberry32(1));
		expect(a01Msh?.[9]).toEqual([["ADT", "A01", "ADT_A01"]]);
		expect(a08Msh?.[9]).toEqual([["ADT", "A08", "ADT_A01"]]);
	});

	test("applies HL7ExportOptions overrides to MSH", () => {
		const [msh] = buildADTMessage(BASE_PATIENT, "A01", createMulberry32(1), {
			sendingApplication: "MY_APP",
			sendingFacility: "MY_FACILITY",
			receivingApplication: "THEIR_APP",
			receivingFacility: "THEIR_FACILITY",
			processingId: "T",
			messageControlId: "custom-id",
		});
		expect(msh?.[3]).toBe("MY_APP");
		expect(msh?.[4]).toBe("MY_FACILITY");
		expect(msh?.[5]).toBe("THEIR_APP");
		expect(msh?.[6]).toBe("THEIR_FACILITY");
		expect(msh?.[10]).toBe("custom-id");
		expect(msh?.[11]).toBe("T");
	});

	test("defaults MSH-10 deterministically from the given PRNG when not overridden", () => {
		const [mshA] = buildADTMessage(BASE_PATIENT, "A01", createMulberry32(1));
		const [mshB] = buildADTMessage(BASE_PATIENT, "A01", createMulberry32(1));
		expect(mshA?.[10]).toBe(mshB?.[10]);
	});

	test("uses the encounter's admission time for MSH-7/EVN-2, falling back to referenceDate when there's no encounter", () => {
		const [mshWithEncounter, evnWithEncounter] = buildADTMessage(
			BASE_PATIENT,
			"A01",
			createMulberry32(1),
		);
		expect(mshWithEncounter?.[7]).toBe("20240305143007+0000");
		expect(evnWithEncounter?.[2]).toBe("20240305143007+0000");

		const patientWithoutEncounter: PatientGraph = {
			...BASE_PATIENT,
			encounters: [],
		};
		const [mshNoEncounter] = buildADTMessage(
			patientWithoutEncounter,
			"A01",
			createMulberry32(1),
		);
		expect(mshNoEncounter?.[7]).toBe("20240101000000+0000");
	});

	test("produces output that serializeMessage can turn into well-formed HL7 text", () => {
		const message = buildADTMessage(BASE_PATIENT, "A01", createMulberry32(1));
		const text = serializeMessage(message);
		expect(text.startsWith("MSH|")).toBe(true);
		expect(text.split("\r").filter(Boolean).length).toBe(4); // MSH, EVN, PID, PV1
	});
});
