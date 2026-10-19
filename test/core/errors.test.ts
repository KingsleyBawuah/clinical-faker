import { describe, expect, test } from "bun:test";
import {
	ClinicalFakerError,
	CyclicDependencyError,
	DependencyNotReadyError,
	DuplicateNodeIdError,
	EmptyHL7MessageError,
	HL7EncodingDepthError,
	InvalidArchetypeError,
	InvalidDecimalsError,
	InvalidPhoneNumbersError,
	InvalidProbabilityError,
	MalformedMSHSegmentError,
	MissingVitalSignUnitError,
	NoCompatibleArchetypeError,
	NoEncounterForClinicalDataError,
	UnknownArchetypeError,
	UnresolvedDependencyError,
	UnsatisfiableObservationSpecError,
} from "../../src/core/errors.ts";

describe("ClinicalFakerError", () => {
	test("is a real Error subclass with its own name", () => {
		const error = new ClinicalFakerError("something went wrong");

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("ClinicalFakerError");
		expect(error.message).toBe("something went wrong");
	});

	test("CyclicDependencyError extends ClinicalFakerError and carries the offending ids", () => {
		const error = new CyclicDependencyError(["a", "b"]);

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("CyclicDependencyError");
		expect(error.nodeIds).toEqual(["a", "b"]);
	});

	test("UnresolvedDependencyError extends ClinicalFakerError and carries the node and dependency ids", () => {
		const error = new UnresolvedDependencyError("a", "missing");

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("UnresolvedDependencyError");
		expect(error.nodeId).toBe("a");
		expect(error.dependencyId).toBe("missing");
	});

	test("DuplicateNodeIdError extends ClinicalFakerError and carries the offending id", () => {
		const error = new DuplicateNodeIdError("a");

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("DuplicateNodeIdError");
		expect(error.nodeId).toBe("a");
	});

	test("DependencyNotReadyError extends ClinicalFakerError and carries the requested node id", () => {
		const error = new DependencyNotReadyError("a");

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("DependencyNotReadyError");
		expect(error.nodeId).toBe("a");
	});

	test("HL7EncodingDepthError extends ClinicalFakerError and carries the offending depth", () => {
		const error = new HL7EncodingDepthError(3);

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("HL7EncodingDepthError");
		expect(error.depth).toBe(3);
	});

	test("MalformedMSHSegmentError extends ClinicalFakerError", () => {
		const error = new MalformedMSHSegmentError();

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("MalformedMSHSegmentError");
	});

	test("EmptyHL7MessageError extends ClinicalFakerError", () => {
		const error = new EmptyHL7MessageError();

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("EmptyHL7MessageError");
	});

	test("MissingVitalSignUnitError extends ClinicalFakerError and carries the observation id and code, not its value", () => {
		const error = new MissingVitalSignUnitError("obs-1", "8867-4");

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("MissingVitalSignUnitError");
		expect(error.observationId).toBe("obs-1");
		expect(error.loincCode).toBe("8867-4");
		expect(error.message).toContain("obs-1");
	});

	test("NoEncounterForClinicalDataError extends ClinicalFakerError and carries only the patient id", () => {
		const error = new NoEncounterForClinicalDataError("patient-1");

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("NoEncounterForClinicalDataError");
		expect(error.patientId).toBe("patient-1");
		expect(error.message).toContain("patient-1");
	});

	test("UnknownArchetypeError extends ClinicalFakerError and names the unknown archetype and the valid ones", () => {
		const error = new UnknownArchetypeError("Missing", ["Alpha", "Beta"]);

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("UnknownArchetypeError");
		expect(error.archetype).toBe("Missing");
		expect(error.validNames).toEqual(["Alpha", "Beta"]);
		expect(error.message).toContain('"Missing"');
		expect(error.message).toContain("Alpha, Beta");
	});

	test("UnknownArchetypeError lists valid names sorted, whatever order they arrive in", () => {
		const error = new UnknownArchetypeError("Missing", [
			"Gamma",
			"Alpha",
			"Beta",
		]);

		expect(error.validNames).toEqual(["Alpha", "Beta", "Gamma"]);
		expect(error.message).toContain("Alpha, Beta, Gamma");
	});

	test("InvalidArchetypeError extends ClinicalFakerError and names the received type, not the value", () => {
		const error = new InvalidArchetypeError("number");

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("InvalidArchetypeError");
		expect(error.receivedType).toBe("number");
		expect(error.message).toContain("number");
	});

	test("UnknownArchetypeError says so when there are no valid names", () => {
		const error = new UnknownArchetypeError("Missing", []);

		expect(error.message).toContain("(none)");
	});

	test("InvalidProbabilityError extends ClinicalFakerError and carries the offending probability", () => {
		const error = new InvalidProbabilityError(-0.5);

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("InvalidProbabilityError");
		expect(error.probability).toBe(-0.5);
		expect(error.message).toContain("-0.5");
	});

	test("UnsatisfiableObservationSpecError extends ClinicalFakerError and carries loincCode, decimals, and clamp", () => {
		const clamp = { min: 1.2, max: 1.8 };
		const error = new UnsatisfiableObservationSpecError("8867-4", 0, clamp);

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("UnsatisfiableObservationSpecError");
		expect(error.loincCode).toBe("8867-4");
		expect(error.decimals).toBe(0);
		expect(error.clamp).toEqual(clamp);
		expect(error.message).toContain("8867-4");
		expect(error.message).toContain("0 decimal places");
		expect(error.message).toContain("[1.2, 1.8]");
	});

	test("InvalidDecimalsError extends ClinicalFakerError and carries the offending decimals", () => {
		const error = new InvalidDecimalsError(1.5);

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("InvalidDecimalsError");
		expect(error.decimals).toBe(1.5);
		expect(error.message).toContain("1.5");
	});

	test("NoCompatibleArchetypeError extends ClinicalFakerError and carries age and gender only", () => {
		const error = new NoCompatibleArchetypeError(45, "female");

		expect(error).toBeInstanceOf(ClinicalFakerError);
		expect(error.name).toBe("NoCompatibleArchetypeError");
		expect(error.age).toBe(45);
		expect(error.gender).toBe("female");
		expect(error.message).toContain("45");
		expect(error.message).toContain("female");
	});

	test("InvalidPhoneNumbersError extends ClinicalFakerError and carries invalidIndices", () => {
		const emptyError = new InvalidPhoneNumbersError(
			"GenerationOptions.phoneNumbers must not be empty",
		);
		expect(emptyError).toBeInstanceOf(ClinicalFakerError);
		expect(emptyError.name).toBe("InvalidPhoneNumbersError");
		expect(emptyError.invalidIndices).toEqual([]);
		expect(emptyError.message).toBe(
			"GenerationOptions.phoneNumbers must not be empty",
		);

		const formatError = new InvalidPhoneNumbersError(
			"GenerationOptions.phoneNumbers contains 2 invalid E.164 entry(ies) at index(es): 0, 2",
			[0, 2],
		);
		expect(formatError).toBeInstanceOf(ClinicalFakerError);
		expect(formatError.name).toBe("InvalidPhoneNumbersError");
		expect(formatError.invalidIndices).toEqual([0, 2]);
		expect(formatError.message).toContain("2 invalid E.164 entry(ies)");
		expect(formatError.message).toContain("0, 2");
	});
});
