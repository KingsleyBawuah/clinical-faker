import { describe, expect, test } from "bun:test";
import {
	ClinicalFakerError,
	CyclicDependencyError,
	DependencyNotReadyError,
	DuplicateNodeIdError,
	EmptyHL7MessageError,
	HL7EncodingDepthError,
	MalformedMSHSegmentError,
	UnresolvedDependencyError,
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
});
