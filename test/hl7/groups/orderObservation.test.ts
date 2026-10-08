import { describe, expect, test } from "bun:test";
import type { ObservationEntity } from "../../../src/entities/types.ts";
import { buildOrderObservationGroup } from "../../../src/hl7/groups/orderObservation.ts";
import type { HL7Order } from "../../../src/hl7/order.ts";

const ORDER: HL7Order = {
	placerOrderNumber: "PLACER1",
	fillerOrderNumber: "FILLER1",
};

function observation(
	loincCode: string,
	effectiveDateTime: string,
): ObservationEntity {
	return { loincCode, display: loincCode, value: 1, effectiveDateTime };
}

describe("buildOrderObservationGroup", () => {
	test("produces ORC, OBR, then one OBX per observation with Set IDs restarting at 1", () => {
		const group = buildOrderObservationGroup(ORDER, 1, [
			observation("8480-6", "2024-03-05T15:00:00.000Z"),
			observation("8462-4", "2024-03-05T15:00:00.000Z"),
		]);
		expect(group.map((segment) => segment[0])).toEqual([
			"ORC",
			"OBR",
			"OBX",
			"OBX",
		]);
		expect(group[0]?.[1]).toBe("RE"); // ORC-1: observations to follow
		expect(group[1]?.[25]).toBe("F"); // OBR-25: final results
		expect(group[2]?.[1]).toBe("1");
		expect(group[3]?.[1]).toBe("2");
	});

	test("uses the earliest observation time for OBR-7, regardless of array order", () => {
		const group = buildOrderObservationGroup(ORDER, 1, [
			observation("8480-6", "2024-03-05T16:00:00.000Z"),
			observation("8462-4", "2024-03-05T14:00:00.000Z"),
		]);
		expect(group[1]?.[7]).toBe("20240305140000+0000");
	});

	test("produces a valid ORC + OBR with zero OBX and no OBR-7 when there are no observations", () => {
		const group = buildOrderObservationGroup(ORDER, 1, []);
		expect(group.map((segment) => segment[0])).toEqual(["ORC", "OBR"]);
		expect(group[1]?.[7]).toBe("");
	});
});
