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

const FIRST_NAMES_UNISEX = [...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE];

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

// Generic names only, so a generated address is unlikely to match a real residence.
export const STREET_NAMES = [
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
	"Birch Lane",
	"Willow Way",
	"Aspen Court",
	"Chestnut Street",
	"Hickory Drive",
	"Magnolia Avenue",
	"Sycamore Road",
	"Spruce Street",
	"Walnut Avenue",
	"Juniper Lane",
	"Park Avenue",
	"Lake Street",
	"River Road",
	"Hillside Drive",
	"Meadow Lane",
	"Valley View Road",
	"Ridge Road",
	"Forest Avenue",
	"Highland Avenue",
	"Orchard Lane",
	"Church Street",
	"Mill Road",
	"School Street",
	"Market Street",
	"Center Street",
	"Union Street",
	"Franklin Street",
	"Jefferson Avenue",
	"Madison Avenue",
	"Adams Street",
	"Spring Street",
	"Prospect Avenue",
	"Brookside Drive",
	"Fairview Avenue",
	"Garden Court",
	"Harbor View Drive",
	"Quail Run",
	"Stonegate Drive",
	"Timber Trail",
	"Windmill Lane",
] as const;

export interface CityLocation {
	city: string;
	state: string;
	postalCode: string;
}

// Real US city/state/ZIP tuples. Every ZIP was checked against the U.S. Census
// Bureau 2020 ZCTA-to-place relationship file
// (https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt):
// each is a 2020 ZCTA — so it has residential delivery, unlike IRS/PO-box-only
// ZIPs such as Austin's 73301 — overlapping the named place in that state.
// City names follow the USPS preferred last-line name (e.g. "Saint Louis"),
// cross-checked via GeoNames postal data (https://api.zippopotam.us/us/<zip>).
// Uniform pick, not population-weighted (see docs/architecture.md's scope notes).
export const CITIES: readonly CityLocation[] = [
	{ city: "Anchorage", state: "AK", postalCode: "99501" },
	{ city: "Birmingham", state: "AL", postalCode: "35203" },
	{ city: "Montgomery", state: "AL", postalCode: "36104" },
	{ city: "Little Rock", state: "AR", postalCode: "72201" },
	{ city: "Phoenix", state: "AZ", postalCode: "85004" },
	{ city: "Tucson", state: "AZ", postalCode: "85701" },
	{ city: "Fresno", state: "CA", postalCode: "93721" },
	{ city: "Oakland", state: "CA", postalCode: "94612" },
	{ city: "Sacramento", state: "CA", postalCode: "95814" },
	{ city: "San Diego", state: "CA", postalCode: "92101" },
	{ city: "Colorado Springs", state: "CO", postalCode: "80903" },
	{ city: "Denver", state: "CO", postalCode: "80202" },
	{ city: "Hartford", state: "CT", postalCode: "06103" },
	{ city: "Washington", state: "DC", postalCode: "20001" },
	{ city: "Wilmington", state: "DE", postalCode: "19801" },
	{ city: "Jacksonville", state: "FL", postalCode: "32202" },
	{ city: "Orlando", state: "FL", postalCode: "32801" },
	{ city: "Tallahassee", state: "FL", postalCode: "32301" },
	{ city: "Tampa", state: "FL", postalCode: "33602" },
	{ city: "Atlanta", state: "GA", postalCode: "30303" },
	{ city: "Columbus", state: "GA", postalCode: "31901" },
	{ city: "Savannah", state: "GA", postalCode: "31401" },
	{ city: "Honolulu", state: "HI", postalCode: "96813" },
	{ city: "Des Moines", state: "IA", postalCode: "50309" },
	{ city: "Boise", state: "ID", postalCode: "83702" },
	{ city: "Chicago", state: "IL", postalCode: "60601" },
	{ city: "Springfield", state: "IL", postalCode: "62704" },
	{ city: "Fort Wayne", state: "IN", postalCode: "46802" },
	{ city: "Indianapolis", state: "IN", postalCode: "46204" },
	{ city: "Topeka", state: "KS", postalCode: "66603" },
	{ city: "Wichita", state: "KS", postalCode: "67202" },
	{ city: "Lexington", state: "KY", postalCode: "40507" },
	{ city: "Louisville", state: "KY", postalCode: "40202" },
	{ city: "Baton Rouge", state: "LA", postalCode: "70802" },
	{ city: "New Orleans", state: "LA", postalCode: "70112" },
	{ city: "Boston", state: "MA", postalCode: "02108" },
	{ city: "Worcester", state: "MA", postalCode: "01608" },
	{ city: "Baltimore", state: "MD", postalCode: "21202" },
	{ city: "Portland", state: "ME", postalCode: "04101" },
	{ city: "Detroit", state: "MI", postalCode: "48226" },
	{ city: "Grand Rapids", state: "MI", postalCode: "49503" },
	{ city: "Lansing", state: "MI", postalCode: "48933" },
	{ city: "Minneapolis", state: "MN", postalCode: "55401" },
	{ city: "Saint Paul", state: "MN", postalCode: "55102" },
	{ city: "Kansas City", state: "MO", postalCode: "64106" },
	{ city: "Saint Louis", state: "MO", postalCode: "63101" },
	{ city: "Springfield", state: "MO", postalCode: "65806" },
	{ city: "Jackson", state: "MS", postalCode: "39201" },
	{ city: "Billings", state: "MT", postalCode: "59102" },
	{ city: "Charlotte", state: "NC", postalCode: "28202" },
	{ city: "Durham", state: "NC", postalCode: "27701" },
	{ city: "Raleigh", state: "NC", postalCode: "27601" },
	{ city: "Bismarck", state: "ND", postalCode: "58501" },
	{ city: "Fargo", state: "ND", postalCode: "58102" },
	{ city: "Lincoln", state: "NE", postalCode: "68508" },
	{ city: "Omaha", state: "NE", postalCode: "68102" },
	{ city: "Manchester", state: "NH", postalCode: "03101" },
	{ city: "Newark", state: "NJ", postalCode: "07102" },
	{ city: "Trenton", state: "NJ", postalCode: "08608" },
	{ city: "Albuquerque", state: "NM", postalCode: "87102" },
	{ city: "Santa Fe", state: "NM", postalCode: "87501" },
	{ city: "Las Vegas", state: "NV", postalCode: "89101" },
	{ city: "Reno", state: "NV", postalCode: "89501" },
	{ city: "Albany", state: "NY", postalCode: "12207" },
	{ city: "Buffalo", state: "NY", postalCode: "14202" },
	{ city: "Rochester", state: "NY", postalCode: "14604" },
	{ city: "Cincinnati", state: "OH", postalCode: "45202" },
	{ city: "Cleveland", state: "OH", postalCode: "44113" },
	{ city: "Columbus", state: "OH", postalCode: "43215" },
	{ city: "Oklahoma City", state: "OK", postalCode: "73102" },
	{ city: "Tulsa", state: "OK", postalCode: "74103" },
	{ city: "Eugene", state: "OR", postalCode: "97401" },
	{ city: "Portland", state: "OR", postalCode: "97201" },
	{ city: "Harrisburg", state: "PA", postalCode: "17101" },
	{ city: "Philadelphia", state: "PA", postalCode: "19103" },
	{ city: "Pittsburgh", state: "PA", postalCode: "15222" },
	{ city: "Providence", state: "RI", postalCode: "02903" },
	{ city: "Charleston", state: "SC", postalCode: "29401" },
	{ city: "Columbia", state: "SC", postalCode: "29201" },
	{ city: "Sioux Falls", state: "SD", postalCode: "57104" },
	{ city: "Knoxville", state: "TN", postalCode: "37902" },
	{ city: "Memphis", state: "TN", postalCode: "38103" },
	{ city: "Nashville", state: "TN", postalCode: "37201" },
	{ city: "Austin", state: "TX", postalCode: "78701" },
	{ city: "Dallas", state: "TX", postalCode: "75201" },
	{ city: "El Paso", state: "TX", postalCode: "79901" },
	{ city: "Houston", state: "TX", postalCode: "77002" },
	{ city: "San Antonio", state: "TX", postalCode: "78205" },
	{ city: "Salt Lake City", state: "UT", postalCode: "84111" },
	{ city: "Norfolk", state: "VA", postalCode: "23510" },
	{ city: "Richmond", state: "VA", postalCode: "23219" },
	{ city: "Burlington", state: "VT", postalCode: "05401" },
	{ city: "Seattle", state: "WA", postalCode: "98101" },
	{ city: "Spokane", state: "WA", postalCode: "99201" },
	{ city: "Madison", state: "WI", postalCode: "53703" },
	{ city: "Milwaukee", state: "WI", postalCode: "53202" },
	{ city: "Charleston", state: "WV", postalCode: "25301" },
	{ city: "Cheyenne", state: "WY", postalCode: "82001" },
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
	return pickFrom(prng, FIRST_NAMES_UNISEX);
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
