import type { Demographics } from "../../entities/types.ts";
import { cx, xad, xpn } from "../composites.ts";
import { toHL7Gender } from "../mappings/gender.ts";
import { toDTM } from "../toDTM.ts";
import type { HL7Segment } from "../types.ts";
import { buildSegmentFromFields } from "./buildSegmentFromFields.ts";

/**
 * Builds a `PID` segment from `Demographics`. `PID-1` (Set ID) is hardcoded
 * to `"1"` — every message this library generates carries exactly one
 * patient, so there's nothing to actually number. `PID-2` (the deprecated
 * External ID field) is intentionally left empty in favor of `PID-3`.
 */
export function buildPIDSegment(demographics: Demographics): HL7Segment {
	return buildSegmentFromFields("PID", {
		1: "1",
		3: cx(demographics.mrn),
		5: xpn(demographics.lastName, demographics.firstName),
		7: toDTM(demographics.dob, "date"),
		8: toHL7Gender(demographics.gender),
		11: xad(demographics.address),
	});
}
