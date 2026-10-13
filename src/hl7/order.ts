import type { PRNG } from "../core/prng/types.ts";
import type { Encounter, Provider } from "../entities/types.ts";
import { generateOrderNumber } from "./orderNumber.ts";

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

/**
 * Derives the message's single order. Placer/filler order numbers each
 * come from their own forked stream, so they're stable per seed and
 * independent of `MSH-10`.
 */
export function buildHL7Order(
	encounter: Encounter | undefined,
	prng: PRNG,
): HL7Order {
	return {
		placerOrderNumber: generateOrderNumber(prng.fork("placer-order-number")),
		fillerOrderNumber: generateOrderNumber(prng.fork("filler-order-number")),
		...(encounter === undefined
			? {}
			: { orderingProvider: encounter.attendingProvider }),
	};
}
