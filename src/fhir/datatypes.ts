import type {
	Address as IRAddress,
	Identifier as IRIdentifier,
} from "../entities/types.ts";
import { toFHIRIdentifierSystem } from "./systems.ts";
import type {
	Address,
	CodeableConcept,
	Coding,
	ContactPoint,
	HumanName,
	Identifier,
	Reference,
} from "./types.ts";

/** A reference to another entry in the same Bundle, by the entity's IR id — see docs/architecture.md's "FHIR R4 referential integrity". */
export function reference(id: string): Reference {
	return { reference: `urn:uuid:${id}` };
}

export function coding(system: string, code: string, display?: string): Coding {
	return display === undefined ? { system, code } : { system, code, display };
}

export function codeableConcept(single: Coding): CodeableConcept {
	return { coding: [single] };
}

/** The IR models one first name, so `given` always has exactly one entry. */
export function humanName(firstName: string, lastName: string): HumanName {
	return { family: lastName, given: [firstName] };
}

/** The IR models one street line; R4's `line` is an array. */
export function address(irAddress: IRAddress): Address {
	return {
		line: [irAddress.line],
		city: irAddress.city,
		state: irAddress.state,
		postalCode: irAddress.postalCode,
		country: irAddress.country,
	};
}

export function identifier(irIdentifier: IRIdentifier): Identifier {
	return {
		system: toFHIRIdentifierSystem(irIdentifier.assigningAuthority),
		value: irIdentifier.value,
	};
}

export function contactPoint(phone: string): ContactPoint {
	return {
		system: "phone",
		value: phone,
		use: "home",
	};
}
