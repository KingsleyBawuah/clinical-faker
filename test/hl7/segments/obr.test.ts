import { describe, expect, test } from "bun:test";
import type { HL7Order } from "../../../src/hl7/order.ts";
import { buildOBRSegment } from "../../../src/hl7/segments/obr.ts";

const ORDER: HL7Order = {
	placerOrderNumber: "PLACER1",
	fillerOrderNumber: "FILLER1",
	orderingProvider: {
		identifier: { value: "1234567893", assigningAuthority: "NPI" },
		firstName: "Jane",
		lastName: "Baker",
	},
};

describe("buildOBRSegment", () => {
	test("places Set ID, order numbers, the default universal service id, observation time, ordering provider, and result status at their HL7 v2.5.1 positions", () => {
		const segment = buildOBRSegment(ORDER, 1, {
			observationDateTime: "2024-03-05T15:00:00.000Z",
			resultStatus: "F",
		});
		expect(segment[1]).toBe("1");
		expect(segment[2]).toBe("PLACER1");
		expect(segment[3]).toBe("FILLER1");
		expect(segment[4]).toEqual([
			[
				"85353-1",
				"Vital signs, weight, height, head circumference, oxygen saturation and BMI panel",
				"LN",
			],
		]);
		expect(segment[7]).toBe("20240305150000+0000");
		expect(segment[16]).toEqual([["1234567893", "Baker", "Jane"]]);
		expect(segment[25]).toBe("F");
	});

	test("always populates the required OBR-4, and omits optional fields it has no data for", () => {
		const segment = buildOBRSegment(
			{ placerOrderNumber: "PLACER1", fillerOrderNumber: "FILLER1" },
			1,
		);
		expect(segment).toHaveLength(5);
		expect(segment[4]).not.toBe("");
	});
});
