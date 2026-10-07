/**
 * Message types `.toHL7()` currently supports. Widens as later phases
 * land: `"ORU^R01"` in the ORU phase, `"ORM^O01"` in the ORM phase — see
 * the PR 2a-2e breakdown in docs/implementation.md. Kept exactly matched to
 * what's actually implemented rather than declared in advance, so a
 * TypeScript consumer never gets a compile-time-valid call that throws at
 * runtime.
 */
export type HL7EventType = "ADT^A01" | "ADT^A08";

/**
 * Message-level metadata `.toHL7()` accepts, distinct from the canonical IR
 * — see docs/architecture.md's "Deliberately not modeled" section for why
 * sending/receiving facility isn't part of `PatientGraph` itself.
 */
export interface HL7ExportOptions {
	/** `MSH-3`. */
	sendingApplication?: string;
	/** `MSH-4`. */
	sendingFacility?: string;
	/** `MSH-5`. */
	receivingApplication?: string;
	/** `MSH-6`. */
	receivingFacility?: string;
	/**
	 * `MSH-10` override — must be at most 20 characters
	 * (`InvalidMessageControlIdError` otherwise). Defaults to a value
	 * deterministically derived from the patient's seed and the requested
	 * event type; only needed when a caller wants several distinct messages
	 * from the same patient to carry different control ids.
	 */
	messageControlId?: string;
	/** `MSH-11`. Defaults to `"P"` (Production) — matches this library's synthetic-but-production-shaped output. */
	processingId?: "P" | "T" | "D";
}
