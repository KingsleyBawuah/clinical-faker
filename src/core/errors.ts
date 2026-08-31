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
