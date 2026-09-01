import type { HL7Segment, HL7Value } from "../types.ts";

/**
 * Builds a segment from a sparse map of 1-based field numbers to values,
 * filling every unspecified field up to the highest one given with an
 * empty string. A segment like `PV1` (44+ fields, most unused for this
 * library's simplified provider/location model) is far more legible and
 * less miscount-prone built this way than as a giant positional array
 * literal padded with dozens of empty-string placeholders.
 */
export function buildSegmentFromFields(
	segmentId: string,
	fields: Readonly<Record<number, HL7Value>>,
): HL7Segment {
	const maxField = Math.max(0, ...Object.keys(fields).map(Number));
	const values: HL7Value[] = [];
	for (let fieldNumber = 1; fieldNumber <= maxField; fieldNumber++) {
		values.push(fields[fieldNumber] ?? "");
	}
	return [segmentId, ...values];
}
