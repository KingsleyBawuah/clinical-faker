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

/**
 * MSG (Message Type) — `MSH-9`'s own composite datatype: message code ^
 * trigger event ^ message structure. Exists for the same reason as every
 * other helper here: writing `["ADT", "A01", "ADT_A01"]` directly as a
 * field value would be read as three *repetitions*, not three components of
 * one message type (see PR 2a's `HL7Value` nesting rule) — caught by
 * external review once `buildMSHSegment`'s `messageType` field made the
 * footgun concrete.
 */
export function msg(
	code: string,
	triggerEvent: string,
	structure: string,
): HL7Value {
	return singleRepetition([code, triggerEvent, structure]);
}

/**
 * CE (Coded with Exceptions) — identifier ^ text ^ name of coding system.
 * Only the first three of CE's six components: this library doesn't model
 * an alternate code/text/coding-system for any coded field. Component
 * order confirmed against HL7 v2.5.1. An empty `identifier` is a valid
 * uncoded value per the spec (e.g. a free-text allergen with no RxNorm/
 * SNOMED code available in the IR) — leave it empty rather than omit the
 * field or invent a code.
 */
export function ce(
	identifier: string,
	text: string,
	codingSystem: string,
): HL7Value {
	return singleRepetition([identifier, text, codingSystem]);
}

/**
 * XTN (Extended Telecommunication Number) per HL7 v2.5.1 (Chapter 2A, Data Types;
 * confirmed against hl7v2-dictionary's XTNType enum):
 * - XTN-1: Telephone Number (deprecated in v2.5.1)
 * - XTN-2: Telecommunication Use Code (PRN = Primary Residence Number, Table 0201)
 * - XTN-3: Telecommunication Equipment Type (PH = Telephone, Table 0202)
 * - XTN-4: Communication Address
 * - XTN-5: Country Code
 * - XTN-6: Area/City Code
 * - XTN-7: Local Number
 * - XTN-8..11: Extension, Any Text, Extension Prefix, Speed Dial Code
 * - XTN-12: Unformatted Telephone Number
 *
 * For +1 numbers (10 digits following +1), splits into country code (XTN-5: "1"),
 * area code (XTN-6), local number (XTN-7).
 * For non-+1 caller-supplied numbers, places the full E.164 string into XTN-12.
 * Both forms include use code PRN and equipment type PH.
 */
export function xtn(phone: string): HL7Value {
	if (phone.startsWith("+1") && phone.length === 12) {
		const countryCode = "1";
		const areaCode = phone.slice(2, 5);
		const localNumber = phone.slice(5);
		return singleRepetition([
			"",
			"PRN",
			"PH",
			"",
			countryCode,
			areaCode,
			localNumber,
		]);
	}
	return singleRepetition([
		"",
		"PRN",
		"PH",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		"",
		phone,
	]);
}
