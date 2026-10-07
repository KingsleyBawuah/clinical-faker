import type { ConditionEntity } from "../../entities/types.ts";
import { ce } from "../composites.ts";
import { toHL7DiagnosisPriority } from "../mappings/diagnosisPriority.ts";
import type { HL7Segment } from "../types.ts";
import { buildSegmentFromFields } from "./buildSegmentFromFields.ts";

/** `DG1-3`'s coding-system component — the ICD-10-CM identifier HL7 v2's own coding-system table expects, confirmed against the base standard's own worked examples. */
const ICD_10_CM_CODING_SYSTEM = "I10";

/**
 * Builds a `DG1` segment from a `ConditionEntity`. `setId` is 1-based, per
 * the condition's position among the conditions carried in this message.
 * `DG1-2` (the legacy Diagnosis Coding Method field) is intentionally left
 * empty — `DG1-3`'s `CE` datatype already carries the coding system as its
 * third component, making `DG1-2` redundant. `DG1-6` (Diagnosis Type)
 * defaults to `"A"` (Admitting): `ADT^A01`/`A08` are admission/update
 * events and `ConditionEntity` has no equivalent concept to derive this
 * from, so "Admitting" is the closest honest default rather than an
 * arbitrary "Working"/"Final" guess.
 */
export function buildDG1Segment(
	condition: ConditionEntity,
	setId: number,
): HL7Segment {
	return buildSegmentFromFields("DG1", {
		1: String(setId),
		3: ce(condition.code, condition.display, ICD_10_CM_CODING_SYSTEM),
		6: "A",
		15: toHL7DiagnosisPriority(condition.rank),
	});
}
