export type NodeId = string;

/**
 * A generic unit of work in the generation DAG. `resolve` is handed a
 * `getResult` accessor scoped to this node's own already-resolved
 * dependencies — the resolver guarantees every id in `dependsOn` is
 * available by the time `resolve` runs.
 */
export interface DAGNode<TResult = unknown> {
	readonly id: NodeId;
	readonly dependsOn: readonly NodeId[];
	resolve(getResult: <T>(nodeId: NodeId) => T): TResult;
}
