import type { DemographicConstraints } from "../archetypes/types.ts";
import type { DAGNode } from "../core/dag/types.ts";
import { UnsatisfiableDemographicConstraintsError } from "../core/errors.ts";
import { pickFrom } from "../core/prng/pickFrom.ts";
import type { PRNG } from "../core/prng/types.ts";
import {
	DEFAULT_PHONE_NUMBERS,
	pickAddress,
	pickFirstName,
	pickGender,
	pickLastName,
} from "../entities/sampleData.ts";
import type { Demographics, Gender, Identifier } from "../entities/types.ts";
import type { SeedResult } from "./seedNode.ts";

export const MIN_ADULT_AGE = 18;
export const MAX_ADULT_AGE = 90;

function deriveDob(referenceDate: string, age: number, prng: PRNG): string {
	const referenceYear = Number(referenceDate.slice(0, 4));
	const referenceMonth = Number(referenceDate.slice(5, 7));
	const referenceDay = Number(referenceDate.slice(8, 10));

	const birthMonth = prng.nextInt(1, 12);
	// Capped at 28 to sidestep month-length edge cases (Feb 30th, etc.) —
	// surface plausibility only, not calendar-exact.
	const birthDay = prng.nextInt(1, 28);

	// age is "as of referenceDate" — if this year's birthday hasn't happened
	// yet relative to referenceDate, the person was born a year earlier than
	// a naive `referenceYear - age` would compute. Getting this wrong makes
	// age and dob mutually inconsistent, violating the one-source-of-truth
	// invariant docs/architecture.md documents for these two fields.
	const birthdayAlreadyOccurredThisYear =
		birthMonth < referenceMonth ||
		(birthMonth === referenceMonth && birthDay <= referenceDay);
	const birthYear = birthdayAlreadyOccurredThisYear
		? referenceYear - age
		: referenceYear - age - 1;

	return `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;
}

function generateMrn(prng: PRNG): Identifier {
	return {
		value: `MRN${prng.nextInt(100000, 999999)}`,
		assigningAuthority: "clinical-faker",
	};
}

export function createDemographicsNode(
	prng: PRNG,
	constraints?: DemographicConstraints,
	phonePool?: readonly string[],
): DAGNode<Demographics> {
	return {
		id: "demographics",
		dependsOn: ["seed"],
		resolve: (getResult) => {
			const seedResult = getResult<SeedResult>("seed");

			let gender: Gender;
			let age: number;

			if (constraints === undefined) {
				gender = pickGender(prng);
				age = prng.nextInt(MIN_ADULT_AGE, MAX_ADULT_AGE);
			} else {
				const effectiveMinAge = Math.max(
					MIN_ADULT_AGE,
					constraints.minAge ?? MIN_ADULT_AGE,
				);
				const effectiveMaxAge = Math.min(
					MAX_ADULT_AGE,
					constraints.maxAge ?? MAX_ADULT_AGE,
				);

				if (
					effectiveMinAge > effectiveMaxAge ||
					(constraints.compatibleGenders !== undefined &&
						constraints.compatibleGenders.length === 0)
				) {
					throw new UnsatisfiableDemographicConstraintsError(
						MIN_ADULT_AGE,
						MAX_ADULT_AGE,
						constraints,
					);
				}

				if (constraints.compatibleGenders !== undefined) {
					gender = pickFrom(prng, constraints.compatibleGenders);
				} else {
					gender = pickGender(prng);
				}

				age = prng.nextInt(effectiveMinAge, effectiveMaxAge);
			}

			const effectivePhonePool = phonePool ?? DEFAULT_PHONE_NUMBERS;
			const phone = pickFrom(prng.fork("phone"), effectivePhonePool);

			return {
				firstName: pickFirstName(prng, gender),
				lastName: pickLastName(prng),
				dob: deriveDob(seedResult.referenceDate, age, prng),
				age,
				gender,
				phone,
				mrn: generateMrn(prng),
				address: pickAddress(prng),
			};
		},
	};
}
