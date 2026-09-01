import { describe, expect, test } from "bun:test";
import type { Encounter } from "../../../src/entities/types.ts";
import { buildPV1Segment } from "../../../src/hl7/segments/pv1.ts";
import { serializeMessage } from "../../../src/hl7/serializeMessage.ts";
import { STANDARD_HL7_DELIMITERS } from "../../../src/hl7/types.ts";

const D = STANDARD_HL7_DELIMITERS;

const PROVIDER = {
	identifier: { value: "1234567893", assigningAuthority: "NPI" },
	firstName: "Jane",
	lastName: "Baker",
};

function fieldsOf(segmentText: string | undefined): string[] {
	return (segmentText ?? "").split(D.field);
}

describe("buildPV1Segment", () => {
	test("reuses the attending provider verbatim for PV1-17 (admitting doctor)", () => {
		const encounter: Encounter = {
			id: "enc-1",
			class: "inpatient",
			period: { start: "2024-03-05T14:30:07.000Z" },
			attendingProvider: PROVIDER,
		};
		const [segmentText] = serializeMessage([buildPV1Segment(encounter)]).split(
			"\r",
		);
		const fields = fieldsOf(segmentText);

		expect(fields[0]).toBe("PV1");
		expect(fields[1]).toBe("1");
		expect(fields[2]).toBe("I");
		expect(fields[7]).toBe(fields[17]);
		expect(fields[7]).toBe(`1234567893${D.component}Baker${D.component}Jane`);
		expect(fields[44]).toBe("20240305143007+0000");
	});

	test("omits PV1-3 (location) and PV1-45 (discharge) when the encounter doesn't have them", () => {
		const encounter: Encounter = {
			id: "enc-2",
			class: "outpatient",
			period: { start: "2024-03-05T14:30:07.000Z" },
			attendingProvider: PROVIDER,
		};
		const [segmentText] = serializeMessage([buildPV1Segment(encounter)]).split(
			"\r",
		);
		const fields = fieldsOf(segmentText);

		expect(fields[3]).toBe("");
		expect(fields.length).toBe(45); // no PV1-45 present at all, not just empty
	});

	test("includes PV1-3 (location) and PV1-45 (discharge) when the encounter has them", () => {
		const encounter: Encounter = {
			id: "enc-3",
			class: "emergency",
			period: {
				start: "2024-03-05T14:30:07.000Z",
				end: "2024-03-05T16:00:00.000Z",
			},
			location: "Emergency Department",
			attendingProvider: PROVIDER,
		};
		const [segmentText] = serializeMessage([buildPV1Segment(encounter)]).split(
			"\r",
		);
		const fields = fieldsOf(segmentText);

		expect(fields[3]).toBe("Emergency Department");
		expect(fields[45]).toBe("20240305160000+0000");
	});
});
