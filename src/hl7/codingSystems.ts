/**
 * `CE`'s "name of coding system" component values used across segments.
 * `LN` is HL7 v2.5.1 Table 0396's code for LOINC, confirmed against the
 * base standard.
 */
export const LOINC_CODING_SYSTEM = "LN";

/**
 * Not listed in base HL7 v2.5.1 Table 0396 (verified — the base table only
 * offers `ISO+`/`ANS+` for units, and `OBX-6`'s spec text defaults an
 * unnamed coding system to `ISO+`). Used anyway because the IR's units are
 * UCUM, not ISO+, and naming the wrong system would be worse than naming a
 * locally-extended one; real-world US 2.5.1 implementation guides use the
 * same `UCUM` value (inferred, not verified against a specific guide).
 */
export const UCUM_CODING_SYSTEM = "UCUM";
