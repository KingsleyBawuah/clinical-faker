import type { Gender } from "../../entities/types.ts";
import { assertExhaustive } from "../assertExhaustive.ts";

/** `PID-8` (Administrative Sex), HL7 v2 Table 0001. Confirmed against the base standard — see docs/architecture.md's "HL7 v2 serialization" section. */
export function toHL7Gender(gender: Gender): "M" | "F" | "O" | "U" {
	switch (gender) {
		case "male":
			return "M";
		case "female":
			return "F";
		case "other":
			return "O";
		case "unknown":
			return "U";
		default:
			return assertExhaustive(gender);
	}
}
