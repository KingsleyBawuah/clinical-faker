import { UnmappedHL7ValueError } from "../../core/errors.ts";

/**
 * Compile-time exhaustiveness check for a mapping function's `switch`: if a
 * new value is added to the source union without a corresponding `case`,
 * the fallthrough argument fails to narrow to `never` and the file no
 * longer typechecks — catching a missed HL7 v2 mapping at compile time
 * instead of silently falling through at runtime. See docs/architecture.md's
 * "Canonical IR -> HL7 v2 coded-value mappings" section.
 */
export function assertExhaustive(value: never): never {
	throw new UnmappedHL7ValueError(value);
}
