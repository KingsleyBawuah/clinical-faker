import type { Address, Identifier, Provider } from "../entities/types.ts";
import type { HL7Value } from "./types.ts";

/**
 * Wraps a non-repeating field's components in the extra array level
 * `HL7Value`'s fixed nesting order requires — the first array level below a
 * field is always repetitions, so a single (non-repeating) composite value
 * needs an explicit single-element wrap, or its components would be read as
 * repetitions instead. See PR 2a's `HL7Value` design in docs/architecture.md.
 */
function singleRepetition(components: readonly HL7Value[]): HL7Value {
	return [components];
}

/**
 * XPN (Extended Person Name): family name ^ given name. Component order
 * confirmed against HL7 v2.5.1, not assumed.
 */
export function xpn(lastName: string, firstName: string): HL7Value {
	return singleRepetition([lastName, firstName]);
}

/**
 * XAD (Extended Address): street ^ other designation ^ city ^ state ^ zip ^
 * country. Component order confirmed against HL7 v2.5.1 — component 2
 * ("other designation", e.g. apartment/suite) has no equivalent in this
 * library's `Address` model and is always empty.
 */
export function xad(address: Address): HL7Value {
	return singleRepetition([
		address.line,
		"",
		address.city,
		address.state,
		address.postalCode,
		address.country,
	]);
}

/**
 * CX (Extended Composite ID with Check Digit): ID number ^ check digit ^
 * check digit scheme ^ assigning authority. Component order confirmed
 * against HL7 v2.5.1 — this library's `Identifier` model has no check
 * digit, so components 2/3 are always empty.
 */
export function cx(identifier: Identifier): HL7Value {
	return singleRepetition([
		identifier.value,
		"",
		"",
		identifier.assigningAuthority,
	]);
}

/**
 * XCN (Extended Composite ID Number and Name for Persons): ID number ^
 * family name ^ given name. Component order confirmed against HL7 v2.5.1.
 */
export function xcn(provider: Provider): HL7Value {
	return singleRepetition([
		provider.identifier.value,
		provider.lastName,
		provider.firstName,
	]);
}
