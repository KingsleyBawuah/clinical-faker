import type { HL7Segment } from "../types.ts";
import { buildSegmentFromFields } from "./buildSegmentFromFields.ts";

/**
 * Builds an `EVN` segment. `EVN-1` (Event Type Code) has been retained for
 * backward compatibility only since HL7 v2.5 (confirmed against the base
 * standard) but is still populated here, since an older interface engine
 * may still expect it. `EVN-2` (Recorded Date/Time) is the segment's one
 * required field.
 */
export function buildEVNSegment(
	triggerEvent: string,
	dateTime: string,
): HL7Segment {
	return buildSegmentFromFields("EVN", {
		1: triggerEvent,
		2: dateTime,
	});
}
