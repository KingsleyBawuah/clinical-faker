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
