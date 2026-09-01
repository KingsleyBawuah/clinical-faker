import { describe, expect, test } from "bun:test";
import type { ObservationEntity } from "../../src/entities/types.ts";
import { projectVitals } from "../../src/entities/vitalsProjection.ts";

function observation(
	overrides: Partial<ObservationEntity> & Pick<ObservationEntity, "loincCode">,
): ObservationEntity {
	return {
		display: "test observation",
		value: 0,
		effectiveDateTime: "2024-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("projectVitals", () => {
	test("returns an empty object for no observations", () => {
		expect(projectVitals([])).toEqual({});
	});

	test("maps every known vital-sign LOINC code to its friendly key", () => {
		const observations: ObservationEntity[] = [
			observation({ loincCode: "8480-6", value: 128 }),
			observation({ loincCode: "8462-4", value: 82 }),
			observation({ loincCode: "8867-4", value: 72 }),
			observation({ loincCode: "8310-5", value: 98.6 }),
			observation({ loincCode: "9279-1", value: 16 }),
			observation({ loincCode: "59408-5", value: 98 }),
		];

		expect(projectVitals(observations)).toEqual({
			systolicBp: 128,
			diastolicBp: 82,
			heartRate: 72,
			temperature: 98.6,
			respiratoryRate: 16,
			spo2: 98,
		});
	});

	test("ignores observations with an unrecognized LOINC code", () => {
		const observations = [observation({ loincCode: "1234-5", value: 42 })];
		expect(projectVitals(observations)).toEqual({});
	});

	test("ignores a known vital-sign code carrying a non-numeric value", () => {
		const observations = [
			observation({ loincCode: "8867-4", value: "irregular" }),
		];
		expect(projectVitals(observations)).toEqual({});
	});
});
