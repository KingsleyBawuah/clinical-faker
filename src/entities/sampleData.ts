import { pickFrom } from "../core/prng/pickFrom.ts";
import type { PRNG } from "../core/prng/types.ts";
import type { Address, Gender } from "./types.ts";

const FIRST_NAMES_MALE = [
	"James",
	"John",
	"Robert",
	"Michael",
	"William",
	"David",
	"Richard",
	"Joseph",
	"Thomas",
	"Charles",
	"Christopher",
	"Daniel",
	"Matthew",
	"Anthony",
	"Mark",
] as const;

const FIRST_NAMES_FEMALE = [
	"Mary",
	"Patricia",
	"Jennifer",
	"Linda",
	"Elizabeth",
	"Barbara",
	"Susan",
	"Jessica",
	"Sarah",
	"Karen",
	"Nancy",
	"Lisa",
	"Margaret",
	"Betty",
	"Sandra",
] as const;

const LAST_NAMES = [
	"Smith",
	"Johnson",
	"Williams",
	"Brown",
	"Jones",
	"Garcia",
	"Miller",
	"Davis",
	"Rodriguez",
	"Martinez",
	"Hernandez",
	"Lopez",
	"Gonzalez",
	"Wilson",
	"Anderson",
	"Taylor",
	"Thomas",
	"Moore",
	"Jackson",
	"Martin",
] as const;

const STREET_NAMES = [
	"Evergreen Terrace",
	"Maple Street",
	"Oak Avenue",
	"Elm Drive",
	"Washington Boulevard",
	"Main Street",
	"Sunset Lane",
	"Pine Road",
	"Cedar Court",
	"Lincoln Avenue",
] as const;

interface CityLocation {
	city: string;
	state: string;
	postalCode: string;
}

// Real US cities/states, illustrative postal codes — surface plausibility only,
// not audited against USPS records (see docs/architecture.md's scope notes).
const CITIES: readonly CityLocation[] = [
	{ city: "Springfield", state: "IL", postalCode: "62704" },
	{ city: "Portland", state: "OR", postalCode: "97201" },
	{ city: "Austin", state: "TX", postalCode: "73301" },
	{ city: "Denver", state: "CO", postalCode: "80202" },
	{ city: "Columbus", state: "OH", postalCode: "43004" },
	{ city: "Nashville", state: "TN", postalCode: "37201" },
	{ city: "Raleigh", state: "NC", postalCode: "27601" },
	{ city: "Boise", state: "ID", postalCode: "83701" },
];

/**
 * Weighted toward male/female (48% each) with a small other/unknown tail
 * (2% each) — a uniform 4-way split would make "other"/"unknown" look
 * unrealistically common for a generic adult patient population.
 */
export function pickGender(prng: PRNG): Gender {
	const roll = prng.nextFloat(0, 1);
	if (roll < 0.48) return "male";
	if (roll < 0.96) return "female";
	if (roll < 0.98) return "other";
	return "unknown";
}

export function pickFirstName(prng: PRNG, gender: Gender): string {
	if (gender === "male") return pickFrom(prng, FIRST_NAMES_MALE);
	if (gender === "female") return pickFrom(prng, FIRST_NAMES_FEMALE);
	return pickFrom(prng, [...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE]);
}

export function pickLastName(prng: PRNG): string {
	return pickFrom(prng, LAST_NAMES);
}

export function pickAddress(prng: PRNG): Address {
	const location = pickFrom(prng, CITIES);
	const streetNumber = prng.nextInt(100, 9999);
	const streetName = pickFrom(prng, STREET_NAMES);
	return {
		line: `${streetNumber} ${streetName}`,
		city: location.city,
		state: location.state,
		postalCode: location.postalCode,
		country: "US",
	};
}
