import type { DAGNode } from "../core/dag/types.ts";
import type { PRNG } from "../core/prng/types.ts";
import {
	pickAddress,
	pickFirstName,
	pickGender,
	pickLastName,
} from "../entities/sampleData.ts";
import type { Demographics, Identifier } from "../entities/types.ts";
import type { SeedResult } from "./seedNode.ts";

// No archetype demographicConstraints exist yet (Phase 4) — this is the
// "realistic default adult range" docs/architecture.md's plausibility
// invariants section refers to until an archetype narrows it.
const MIN_ADULT_AGE = 18;
const MAX_ADULT_AGE = 90;

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

export function createDemographicsNode(prng: PRNG): DAGNode<Demographics> {
	return {
		id: "demographics",
		dependsOn: ["seed"],
		resolve: (getResult) => {
			const seedResult = getResult<SeedResult>("seed");
			const gender = pickGender(prng);
			const age = prng.nextInt(MIN_ADULT_AGE, MAX_ADULT_AGE);

			return {
				firstName: pickFirstName(prng, gender),
				lastName: pickLastName(prng),
				dob: deriveDob(seedResult.referenceDate, age, prng),
				age,
				gender,
				mrn: generateMrn(prng),
				address: pickAddress(prng),
			};
		},
	};
}
