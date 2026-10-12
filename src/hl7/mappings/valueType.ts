/**
 * `OBX-2` (Value Type), HL7 v2 Table 0125. Decided by the IR value's own
 * runtime type rather than by inspecting its contents, so a string that
 * happens to look numeric (`"142"`) stays `ST` — the IR already chose to
 * store it as text. Confirmed against the base standard — see
 * docs/architecture.md's "HL7 v2 serialization" section.
 */
export function toHL7ValueType(value: number | string): "NM" | "ST" {
	return typeof value === "number" ? "NM" : "ST";
}
