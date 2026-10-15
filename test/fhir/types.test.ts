import { describe, expect, test } from "bun:test";
import type {
	Bundle,
	BundleEntryRequest,
	CodeableConcept,
	Encounter,
	Observation,
	ObservationBase,
	ObservationComponent,
	Patient,
	Quantity,
} from "../../src/fhir/types.ts";

// Compile-time contract checks: each constant's type is `true` or `false`
// depending on whether a shape type-checks, so a wrong `true`/`false`
// literal below fails `bun run typecheck`. The runtime asserts only keep
// the constants used.
type Assignable<A, B> = [A] extends [B] ? true : false;

type PatientEntry = { fullUrl: string; resource: Patient };
type TransactionEntry = PatientEntry & { request: BundleEntryRequest };
type BundleOf<Type, Entry> = {
	resourceType: "Bundle";
	id: string;
	type: Type;
	entry: Entry[];
};

describe("FHIR R4 types", () => {
	test("Bundle: entry.request is mandatory for transaction and prohibited for collection", () => {
		const collection: Assignable<
			BundleOf<"collection", PatientEntry>,
			Bundle
		> = true;
		const transaction: Assignable<
			BundleOf<"transaction", TransactionEntry>,
			Bundle
		> = true;
		const collectionWithRequest: Assignable<
			BundleOf<"collection", TransactionEntry>,
			Bundle
		> = false;
		const transactionWithoutRequest: Assignable<
			BundleOf<"transaction", PatientEntry>,
			Bundle
		> = false;

		expect([
			collection,
			transaction,
			collectionWithRequest,
			transactionWithoutRequest,
		]).toEqual([true, true, false, false]);
	});

	test("Observation: dataAbsentReason only without a value (R4 obs-6); a panel may carry neither", () => {
		const quantityOnly: Assignable<
			ObservationBase & { valueQuantity: Quantity },
			Observation
		> = true;
		const panelWithNeither: Assignable<ObservationBase, Observation> = true;
		const valueAndAbsentReason: Assignable<
			ObservationBase & {
				valueQuantity: Quantity;
				dataAbsentReason: CodeableConcept;
			},
			Observation
		> = false;

		expect([quantityOnly, panelWithNeither, valueAndAbsentReason]).toEqual([
			true,
			true,
			false,
		]);
	});

	test("ObservationComponent: exactly one of valueQuantity or dataAbsentReason", () => {
		const neither: Assignable<{ code: CodeableConcept }, ObservationComponent> =
			false;
		const both: Assignable<
			{
				code: CodeableConcept;
				valueQuantity: Quantity;
				dataAbsentReason: CodeableConcept;
			},
			ObservationComponent
		> = false;

		expect([neither, both]).toEqual([false, false]);
	});

	test("Encounter.class is narrowed to v3-ActCode IMP/AMB/EMER", () => {
		const unknownCode: Assignable<
			{
				system: "http://terminology.hl7.org/CodeSystem/v3-ActCode";
				code: "XYZ";
			},
			Encounter["class"]
		> = false;
		const otherSystem: Assignable<
			{ system: "http://example.org"; code: "IMP" },
			Encounter["class"]
		> = false;
		const inpatient: Assignable<
			{
				system: "http://terminology.hl7.org/CodeSystem/v3-ActCode";
				code: "IMP";
			},
			Encounter["class"]
		> = true;

		expect([unknownCode, otherSystem, inpatient]).toEqual([false, false, true]);
	});

	test("CodeableConcept needs at least one coding or a text", () => {
		const empty: Assignable<Record<string, never>, CodeableConcept> = false;
		const emptyCodingArray: Assignable<{ coding: [] }, CodeableConcept> = false;
		const textOnly: Assignable<{ text: string }, CodeableConcept> = true;

		expect([empty, emptyCodingArray, textOnly]).toEqual([false, false, true]);
	});
});
