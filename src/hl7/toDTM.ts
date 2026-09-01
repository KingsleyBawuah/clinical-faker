/** Date-only (`PID-7`) or full timestamp (`MSH-7`, `EVN-2`, `PV1-44`, `OBR-7`, `OBX-14`) precision. */
export type DTMPrecision = "date" | "datetime";

function pad(value: number, length: number): string {
	return value.toString().padStart(length, "0");
}

/**
 * Converts an ISO-8601 date/datetime (the canonical IR's own format) into
 * HL7 v2.5.1's `DTM` datatype: `YYYY[MM[DD[HH[MM[SS[.S...]]]]]][+/-ZZZZ]` —
 * no hyphens, colons, or `T` separator, confirmed against the base
 * standard rather than assumed (see docs/architecture.md's "HL7 v2
 * serialization" section). `"datetime"` always appends an explicit `+0000`
 * offset rather than omitting it: `DTM` treats a missing offset as
 * defaulting to the sender's local time, which would be actively wrong
 * here since every timestamp this library generates is UTC.
 */
export function toDTM(iso: string, precision: DTMPrecision): string {
	const date = new Date(iso);
	const datePart = `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1, 2)}${pad(date.getUTCDate(), 2)}`;
	if (precision === "date") {
		return datePart;
	}
	const timePart = `${pad(date.getUTCHours(), 2)}${pad(date.getUTCMinutes(), 2)}${pad(date.getUTCSeconds(), 2)}`;
	return `${datePart}${timePart}+0000`;
}
