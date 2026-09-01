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
	const birthYear = referenceYear - age;
	const birthMonth = String(prng.nextInt(1, 12)).padStart(2, "0");
	// Capped at 28 to sidestep month-length edge cases (Feb 30th, etc.) —
	// surface plausibility only, not calendar-exact.
	const birthDay = String(prng.nextInt(1, 28)).padStart(2, "0");
	return `${birthYear}-${birthMonth}-${birthDay}`;
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
