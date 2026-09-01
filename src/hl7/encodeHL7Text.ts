import type { HL7Delimiters } from "./types.ts";

/**
 * A raw `\r` or `\n` inside a leaf value is a distinct hazard from the five
 * `MSH-2` delimiter characters: it doesn't collide with a *field*-level
 * delimiter, it collides with `serializeMessage()`'s own segment
 * terminator, so an unescaped one would silently fragment one segment into
 * two on the wire. Escaped with the standard HL7 v2 hex-escape sequences
 * (`\X0D\`/`\X0A\`), not the `\.br\` formatted-text sequence, since this is
 * about producing conformant wire bytes for arbitrary leaf content, not
 * formatting a `TX`-type field for display.
 */
function containsAnyDelimiter(raw: string, delimiters: HL7Delimiters): boolean {
	return (
		raw.includes(delimiters.escape) ||
		raw.includes(delimiters.field) ||
		raw.includes(delimiters.component) ||
		raw.includes(delimiters.subcomponent) ||
		raw.includes(delimiters.repetition) ||
		raw.includes("\r") ||
		raw.includes("\n")
	);
}

/**
 * Escapes a raw leaf string so its content can't be mistaken for a
 * delimiter once embedded in an HL7 v2 message. Must replace the escape
 * character itself first: escaping a delimiter inserts new escape
 * characters into the output, and escaping *those* on a later pass would
 * corrupt the result (e.g. `|` -> `\F\`, then a naive second pass over `\`
 * turns that into `\E\F\E\`). Confirmed against HL7 v2.5.1's defined escape
 * sequences (`\E\` `\F\` `\S\` `\T\` `\R\`) before relying on this order —
 * see docs/architecture.md's "HL7 v2 serialization" section. Skips all
 * splitting/allocation for the common case of a value with no delimiter
 * characters at all (checked against the actual `delimiters` passed in,
 * not a hardcoded character set, so a future non-standard delimiter set
 * can't silently bypass this fast path).
 */
export function encodeHL7Text(raw: string, delimiters: HL7Delimiters): string {
	if (!containsAnyDelimiter(raw, delimiters)) {
		return raw;
	}
	const esc = delimiters.escape;
	let out = raw.split(esc).join(`${esc}E${esc}`);
	out = out.split(delimiters.field).join(`${esc}F${esc}`);
	out = out.split(delimiters.component).join(`${esc}S${esc}`);
	out = out.split(delimiters.subcomponent).join(`${esc}T${esc}`);
	out = out.split(delimiters.repetition).join(`${esc}R${esc}`);
	out = out.split("\r").join(`${esc}X0D${esc}`);
	out = out.split("\n").join(`${esc}X0A${esc}`);
	return out;
}
