import type { HL7Delimiters } from "./types.ts";

/**
 * Escapes a raw leaf string so its content can't be mistaken for a
 * delimiter once embedded in an HL7 v2 message. Must replace the escape
 * character itself first: escaping a delimiter inserts new escape
 * characters into the output, and escaping *those* on a later pass would
 * corrupt the result (e.g. `|` -> `\F\`, then a naive second pass over `\`
 * turns that into `\E\F\E\`). Confirmed against HL7 v2.5.1's defined escape
 * sequences (`\E\` `\F\` `\S\` `\T\` `\R\`) before relying on this order —
 * see docs/architecture.md's "HL7 v2 serialization" section.
 */
export function encodeHL7Text(raw: string, delimiters: HL7Delimiters): string {
	const esc = delimiters.escape;
	let out = raw.split(esc).join(`${esc}E${esc}`);
	out = out.split(delimiters.field).join(`${esc}F${esc}`);
	out = out.split(delimiters.component).join(`${esc}S${esc}`);
	out = out.split(delimiters.subcomponent).join(`${esc}T${esc}`);
	out = out.split(delimiters.repetition).join(`${esc}R${esc}`);
	return out;
}
