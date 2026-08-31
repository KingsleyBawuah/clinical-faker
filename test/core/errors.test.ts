import { describe, expect, test } from "bun:test";
import {
	ClinicalFakerError,
	CyclicDependencyError,
	DependencyNotReadyError,
	DuplicateNodeIdError,
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
});
