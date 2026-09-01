/**
 * A field's value: a plain string, or (recursively) an array of narrower
 * values. Position in the tree — not the shape of the value itself —
 * determines which delimiter applies when serialized: the first array level
 * below a field is repetitions (`~`), the next is components (`^`), the
 * next is subcomponents (`&`). See docs/architecture.md's "HL7 v2
 * serialization" section for why this fixed positional order (rather than
 * inferring structure from the value alone) is what resolves the otherwise
 * genuine ambiguity between "these are repetitions" and "these are
 * components" for a plain string array.
 */
export type HL7Value = string | readonly HL7Value[];

/** `[segmentId, ...fields]` — field 1 is `segment[1]`, matching HL7's own 1-based field numbering. */
export type HL7Segment = readonly [string, ...HL7Value[]];

export type HL7Message = readonly HL7Segment[];

/** The five delimiter/escape characters declared in `MSH-2` ("encoding characters"). */
export interface HL7Delimiters {
	readonly field: string;
	readonly component: string;
	readonly repetition: string;
	readonly escape: string;
	readonly subcomponent: string;
}

/** `^~\&` — the standard HL7 v2 encoding characters, and the only set this library generates. */
export const STANDARD_HL7_DELIMITERS: HL7Delimiters = {
	field: "|",
	component: "^",
	repetition: "~",
	escape: "\\",
	subcomponent: "&",
};

/**
 * HL7 v2.5.1 requires a bare carriage return between segments — never `\n`
 * or `\r\n`. Confirmed against HL7 v2.5.1 Chapter 2 and HAPI HL7v2's own
 * line-ending handling before relying on it; see docs/architecture.md.
 */
export const HL7_SEGMENT_TERMINATOR = "\r";
