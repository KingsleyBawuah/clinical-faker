import type { Provider } from "../entities/types.ts";

/**
 * The order-level data `ORC`/`OBR` need. Deliberately an HL7-serialization
 * concern rather than a canonical IR entity: there's no `Order` in
 * `PatientGraph` (see docs/architecture.md's "Deliberately not modeled"),
 * so placer/filler numbers are generated at serialization time from the
 * seed and the ordering provider is the encounter's attending provider.
 */
export interface HL7Order {
	/** `ORC-2`/`OBR-2`. */
	placerOrderNumber: string;
	/** `ORC-3`/`OBR-3`. */
	fillerOrderNumber: string;
	/** `ORC-12`/`OBR-16`. Absent when the patient has no encounter to take an attending provider from. */
	orderingProvider?: Provider;
}
