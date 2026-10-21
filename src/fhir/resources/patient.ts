import type { Demographics } from "../../entities/types.ts";
import { address, contactPoint, humanName, identifier } from "../datatypes.ts";
import type { Patient } from "../types.ts";

/** Builds a `Patient` from `Demographics`, keyed by the `PatientGraph`'s own id. The IR's `Gender` matches R4's `AdministrativeGender` value for value. */
export function buildPatient(
	patientId: string,
	demographics: Demographics,
): Patient {
	return {
		resourceType: "Patient",
		id: patientId,
		identifier: [identifier(demographics.mrn)],
		name: [humanName(demographics.firstName, demographics.lastName)],
		telecom: [contactPoint(demographics.phone)],
		gender: demographics.gender,
		birthDate: demographics.dob,
		address: [address(demographics.address)],
	};
}
