/** Base class for every error this library throws, so consumers can catch them all with one type. */
export class ClinicalFakerError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class CyclicDependencyError extends ClinicalFakerError {
	readonly nodeIds: readonly string[];

	constructor(nodeIds: readonly string[]) {
		super(`Cyclic dependency detected among DAG nodes: ${nodeIds.join(", ")}`);
		this.nodeIds = nodeIds;
	}
}

export class DuplicateNodeIdError extends ClinicalFakerError {
	readonly nodeId: string;

	constructor(nodeId: string) {
		super(`Duplicate DAG node id: "${nodeId}"`);
		this.nodeId = nodeId;
	}
}

export class UnresolvedDependencyError extends ClinicalFakerError {
	readonly nodeId: string;
	readonly dependencyId: string;

	constructor(nodeId: string, dependencyId: string) {
		super(`DAG node "${nodeId}" depends on unknown node "${dependencyId}"`);
		this.nodeId = nodeId;
		this.dependencyId = dependencyId;
	}
}

/**
 * Thrown when a node's `resolve` calls `getResult` for an id it didn't
 * declare in its own `dependsOn` before that id has actually resolved. A
 * node can only safely read what it declared as a dependency — this is an
 * invariant violation in the node's own definition, not a graph-shape
 * problem `resolveDAG` can catch upfront, but it's still a library-defined
 * error a node author (including a future custom-node author) should be
 * able to catch alongside every other `ClinicalFakerError`.
 */
export class DependencyNotReadyError extends ClinicalFakerError {
	readonly nodeId: string;

	constructor(nodeId: string) {
		super(
			`DAG node "${nodeId}" was requested before it was resolved — it must be declared in the reading node's own "dependsOn"`,
		);
		this.nodeId = nodeId;
	}
}

/** Thrown when `GenerationOptions.seed` is not a finite number (e.g. `NaN` or `Infinity`). */
export class InvalidSeedError extends ClinicalFakerError {
	readonly seed: number;

	constructor(seed: number) {
		super(`GenerationOptions.seed must be a finite number, got ${seed}`);
		this.seed = seed;
	}
}

/** Thrown when `GenerationOptions.referenceDate` isn't a real `YYYY-MM-DD` calendar date. */
export class InvalidReferenceDateError extends ClinicalFakerError {
	readonly referenceDate: string;

	constructor(referenceDate: string) {
		super(
			`GenerationOptions.referenceDate must be a real calendar date in "YYYY-MM-DD" format, got "${referenceDate}"`,
		);
		this.referenceDate = referenceDate;
	}
}

/**
 * Thrown when an `HL7Value` nests deeper than HL7 v2 actually supports below
 * a field (repetition -> component -> subcomponent, 3 levels). A 4th array
 * level has no delimiter left to join with, which means the value was built
 * incorrectly rather than describing a real HL7 v2 structure.
 */
export class HL7EncodingDepthError extends ClinicalFakerError {
	readonly depth: number;

	constructor(depth: number) {
		super(
			`HL7 v2 field values can nest at most 3 levels below a field (repetition, component, subcomponent) — got depth ${depth}`,
		);
		this.depth = depth;
	}
}

/**
 * Thrown when an `MSH` segment's first two fields (the field separator and
 * encoding characters) aren't plain strings. Those two fields *are* the
 * delimiters the rest of the message is built from, not ordinary content —
 * see docs/architecture.md's "HL7 v2 serialization" section for why `MSH`
 * needs this special case at all.
 */
export class MalformedMSHSegmentError extends ClinicalFakerError {
	constructor() {
		super(
			"MSH-1 (field separator) and MSH-2 (encoding characters) must be plain strings, not nested HL7Value arrays",
		);
	}
}
