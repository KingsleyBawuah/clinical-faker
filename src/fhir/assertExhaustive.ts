import { UnmappedFHIRValueError } from "../core/errors.ts";

/**
 * FHIR layer's compile-time exhaustiveness check — the same pattern as
 * `src/hl7/assertExhaustive.ts`, but throwing a FHIR-named error so an
 * unmapped value reports the format it actually came from.
 */
export function assertExhaustive(value: never): never {
	throw new UnmappedFHIRValueError(value);
}
