import { describe, expect, test } from "bun:test";
import type { HL7Order } from "../../../src/hl7/order.ts";
import { buildORCSegment } from "../../../src/hl7/segments/orc.ts";

const PROVIDER = {
	identifier: { value: "1234567893", assigningAuthority: "NPI" },
	firstName: "Jane",
	lastName: "Baker",
};

describe("buildORCSegment", () => {
	test("places order control at ORC-1, order numbers at ORC-2/ORC-3, and the ordering provider at ORC-12", () => {
		const order: HL7Order = {
			placerOrderNumber: "PLACER1",
			fillerOrderNumber: "FILLER1",
			orderingProvider: PROVIDER,
		};
		const segment = buildORCSegment(order, "RE");
		expect(segment).toHaveLength(13);
		expect(segment[1]).toBe("RE");
		expect(segment[2]).toBe("PLACER1");
		expect(segment[3]).toBe("FILLER1");
		expect(segment[12]).toEqual([["1234567893", "Baker", "Jane"]]);
	});

	test("stops at ORC-3 when there is no ordering provider", () => {
		const segment = buildORCSegment(
			{ placerOrderNumber: "PLACER1", fillerOrderNumber: "FILLER1" },
			"NW",
		);
		expect(segment).toEqual(["ORC", "NW", "PLACER1", "FILLER1"]);
	});
});
