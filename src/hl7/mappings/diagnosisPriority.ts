import type { ConditionRank } from "../../entities/types.ts";
import { assertExhaustive } from "../assertExhaustive.ts";

/** `DG1-15` (Diagnosis Priority). Confirmed against the base standard — see docs/architecture.md's "HL7 v2 serialization" section. */
export function toHL7DiagnosisPriority(rank: ConditionRank): "1" | "2" {
	switch (rank) {
		case "primary":
			return "1";
		case "secondary":
			return "2";
		default:
			return assertExhaustive(rank);
	}
}
