import {
	EmptyHL7MessageError,
	HL7EncodingDepthError,
	MalformedMSHSegmentError,
} from "../core/errors.ts";
import { encodeHL7Text } from "./encodeHL7Text.ts";
import type {
	HL7Delimiters,
	HL7Message,
	HL7Segment,
	HL7Value,
} from "./types.ts";
import { HL7_SEGMENT_TERMINATOR, STANDARD_HL7_DELIMITERS } from "./types.ts";

/** `HL7Value` nesting below a field, in order from the outermost array level to the innermost. */
const SUB_FIELD_DELIMITER_ORDER: readonly (keyof HL7Delimiters)[] = [
	"repetition",
	"component",
	"subcomponent",
];

function serializeValue(
	value: HL7Value,
	delimiters: HL7Delimiters,
	depth: number,
): string {
	if (typeof value === "string") {
		return encodeHL7Text(value, delimiters);
	}
	const delimiterKey = SUB_FIELD_DELIMITER_ORDER[depth];
	if (delimiterKey === undefined) {
		throw new HL7EncodingDepthError(depth);
	}
	return value
		.map((child) => serializeValue(child, delimiters, depth + 1))
		.join(delimiters[delimiterKey]);
}

/**
 * `MSH-1` (field separator) and `MSH-2` (encoding characters) are written
 * verbatim — never escaped, never given an extra leading field separator —
 * because they *are* the delimiters the rest of the segment is built from,
 * not content that uses them. Every field from `MSH-3` onward follows the
 * same leading-separator convention as every other segment. See
 * docs/architecture.md's "HL7 v2 serialization" section for the double-pipe
 * corruption this avoids: naively array-joining `MSH` like any other
 * segment would insert a second separator in front of `MSH-1`'s own value,
 * which already *is* the separator.
 */
function serializeMSHSegment(
	fields: readonly HL7Value[],
	delimiters: HL7Delimiters,
): string {
	const [fieldSeparator, encodingCharacters, ...rest] = fields;
	if (
		typeof fieldSeparator !== "string" ||
		typeof encodingCharacters !== "string"
	) {
		throw new MalformedMSHSegmentError();
	}
	const tail = rest
		.map((field) => delimiters.field + serializeValue(field, delimiters, 0))
		.join("");
	return `MSH${fieldSeparator}${encodingCharacters}${tail}`;
}

function serializeSegment(
	segment: HL7Segment,
	delimiters: HL7Delimiters,
): string {
	const [segmentId, ...fields] = segment;
	if (segmentId === "MSH") {
		return serializeMSHSegment(fields, delimiters);
	}
	const tail = fields
		.map((field) => delimiters.field + serializeValue(field, delimiters, 0))
		.join("");
	return segmentId + tail;
}

/**
 * Serializes a whole message (segment -> field -> repetition -> component ->
 * subcomponent, nested arrays per `HL7Value`) into HL7 v2 wire text.
 * Segments are joined by a bare carriage return — never `\n` — matching HL7
 * v2.5.1's segment terminator, and the output ends with a trailing
 * terminator after the last segment, matching real-world message framing.
 * Throws `EmptyHL7MessageError` for a zero-segment message — every real
 * message needs at least an `MSH`, so returning a bare `\r` for `[]` would
 * silently mask a caller bug rather than surfacing it.
 */
export function serializeMessage(
	message: HL7Message,
	delimiters: HL7Delimiters = STANDARD_HL7_DELIMITERS,
): string {
	if (message.length === 0) {
		throw new EmptyHL7MessageError();
	}
	return (
		message
			.map((segment) => serializeSegment(segment, delimiters))
			.join(HL7_SEGMENT_TERMINATOR) + HL7_SEGMENT_TERMINATOR
	);
}
