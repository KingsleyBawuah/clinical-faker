import type { AllergyCriticality } from "../../entities/types.ts";
import { assertExhaustive } from "../assertExhaustive.ts";

/** `AL1-4` (Allergy Severity Code), HL7 v2 Table 0128. Confirmed against the base standard — see docs/architecture.md's "HL7 v2 serialization" section. */
export function toHL7AllergySeverity(
	criticality: AllergyCriticality,
): "MI" | "SV" | "U" {
	switch (criticality) {
		case "low":
			return "MI";
		case "high":
			return "SV";
		case "unable-to-assess":
			return "U";
		default:
			return assertExhaustive(criticality);
	}
}
