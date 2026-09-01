import { describe, expect, test } from "bun:test";
import { HL7Message } from "hl7v2";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import type { PatientGraph } from "../../src/entities/types.ts";
import { createPatient } from "../../src/generator.ts";
import { toHL7Gender } from "../../src/hl7/mappings/gender.ts";
import { buildADTMessage } from "../../src/hl7/messages/adt.ts";
import { serializeMessage } from "../../src/hl7/serializeMessage.ts";

/**
 * Cross-validates generated messages against `hl7v2` (npm, MIT,
 * devDependency only — see docs/architecture.md's "Cross-validation with
 * independent parsers"), an unrelated third-party implementation. A
 * round-trip test against our own serializer can't catch a case where our
 * output is subtly non-conformant, since the same misunderstanding would
 * produce both the message and the test that checks it — an independent
 * parser can.
 *
 * Every field position and composite-datatype component order used by
 * `buildMSHSegment`/`buildPIDSegment`/`buildPV1Segment`/`buildEVNSegment`/
 * `buildDG1Segment`/`buildAL1Segment` was also independently confirmed
 * against `hl7v2-dictionary`'s own HL7 v2.5.1 field/type definitions
 * (`node_modules/hl7v2-dictionary/segment-fields`,
 * `node_modules/hl7v2-dictionary/type-fields`) before writing this test —
 * not just exercised by it.
 */
describe("HL7 v2 cross-validation (independent parser: hl7v2)", () => {
	test("a generated ADT^A01 message parses cleanly and its segments/version/message type/control id round-trip", () => {
		const patient = createPatient({ seed: 42 });
		const raw = patient.toHL7("ADT^A01");

		const message = HL7Message.parse(raw);

		expect(message.version).toBe("2.5.1");
		expect(message.messageType).toBe("ADT^A01");
		// MSH-10 is field position 10; splitting the raw MSH line the same way
		// the wire format itself is delimited, independent of hl7v2's own parsing.
		const mshControlId = raw.split("\r")[0]?.split("|")[9];
		if (mshControlId === undefined) throw new Error("unreachable");
		expect(message.controlId).toBe(mshControlId);
		expect(message.segments.map((segment) => segment.segmentType)).toEqual([
			"MSH",
			"EVN",
			"PID",
			"PV1",
		]);
	});

	test("a generated ADT^A08 message parses cleanly with the A08 trigger event", () => {
		const patient = createPatient({ seed: 7 });
		const message = HL7Message.parse(patient.toHL7("ADT^A08"));
		expect(message.messageType).toBe("ADT^A08");
	});

	test("PID/PV1 field values recognized by the independent dictionary match what the builders wrote", () => {
		const patient = createPatient({ seed: 42 });
		const message = HL7Message.parse(patient.toHL7("ADT^A01"));

		const pid = message.getSegment("PID");
		expect(pid).toBeDefined();
		if (pid === undefined) throw new Error("unreachable");
		expect(pid.field(3).getValue()).toBe(patient.demographics.mrn.value);
		expect(pid.field(5).getValue()).toBe(patient.demographics.lastName);
		expect(pid.field(8).getValue()).toBe(
			toHL7Gender(patient.demographics.gender),
		);

		const pv1 = message.getSegment("PV1");
		expect(pv1).toBeDefined();
		if (pv1 === undefined) throw new Error("unreachable");
		expect(pv1.field(2).getValue()).toBe("O"); // Phase 1's default demographics-only encounter is outpatient-weighted; seed 42 lands here
	});

	test("DG1/AL1 are recognized as real segments with correctly-positioned fields once conditions/allergies exist", () => {
		const patient: PatientGraph = {
			id: "pat-1",
			seed: 1,
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
			conditions: [
				{ code: "I10", display: "Essential hypertension", rank: "primary" },
				{
					code: "E78.5",
					display: "Hyperlipidemia, unspecified",
					rank: "secondary",
				},
			],
			observations: [],
			medications: [],
			allergies: [
				{ substance: "Penicillin", reaction: "Hives", criticality: "high" },
			],
		};
		const message = HL7Message.parse(
			serializeMessage(buildADTMessage(patient, "A01", createMulberry32(1))),
		);

		expect(message.segments.map((segment) => segment.segmentType)).toEqual([
			"MSH",
			"EVN",
			"PID",
			"PV1",
			"DG1",
			"DG1",
			"AL1",
		]);

		const [primaryDg1, secondaryDg1] = message.segments.filter(
			(segment) => segment.segmentType === "DG1",
		);
		expect(primaryDg1?.field(3).getValue()).toBe("I10");
		expect(primaryDg1?.field(15).getValue()).toBe("1");
		expect(secondaryDg1?.field(3).getValue()).toBe("E78.5");
		expect(secondaryDg1?.field(15).getValue()).toBe("2");

		const al1 = message.getSegment("AL1");
		expect(al1).toBeDefined();
		if (al1 === undefined) throw new Error("unreachable");
		expect(al1.field(3).component(2).getValue()).toBe("Penicillin");
		expect(al1.field(4).getValue()).toBe("SV");
		expect(al1.field(5).getValue()).toBe("Hives");
	});
});
