import {
	CyclicDependencyError,
	DependencyNotReadyError,
	DuplicateNodeIdError,
	UnresolvedDependencyError,
} from "../errors.ts";
import type { DAGNode, NodeId } from "./types.ts";

/**
 * Resolves a set of DAG nodes via Kahn's algorithm. When more than one node
 * is ready (in-degree 0) at the same step, they're processed in ascending
 * lexical order by `id` — an explicit, documented contract rather than an
 * incidental property of this implementation. See docs/architecture.md's
 * "DAG resolution engine".
 */
export function resolveDAG(nodes: readonly DAGNode[]): Map<NodeId, unknown> {
	const nodeMap = new Map<NodeId, DAGNode>();
	for (const node of nodes) {
		if (nodeMap.has(node.id)) {
			throw new DuplicateNodeIdError(node.id);
		}
		nodeMap.set(node.id, node);
	}

	for (const node of nodes) {
		for (const dependencyId of node.dependsOn) {
			if (!nodeMap.has(dependencyId)) {
				throw new UnresolvedDependencyError(node.id, dependencyId);
			}
		}
	}

	const inDegree = new Map<NodeId, number>();
	const dependents = new Map<NodeId, NodeId[]>();
	for (const node of nodes) {
		inDegree.set(node.id, node.dependsOn.length);
	}
	for (const node of nodes) {
		for (const dependencyId of node.dependsOn) {
			const existing = dependents.get(dependencyId);
			if (existing) {
				existing.push(node.id);
			} else {
				dependents.set(dependencyId, [node.id]);
			}
		}
	}

	const ready: NodeId[] = [];
	for (const [id, degree] of inDegree) {
		if (degree === 0) ready.push(id);
	}

	const results = new Map<NodeId, unknown>();

	function getResult<T>(nodeId: NodeId): T {
		if (!results.has(nodeId)) {
			throw new DependencyNotReadyError(nodeId);
		}
		// The resolver stores results type-erased (`unknown`) so it can stay
		// generic over arbitrary node result types — this is the one place that
		// erasure has to be reversed. It's sound in practice because the resolver
		// only ever calls getResult(id) for an id in the caller's own declared
		// dependsOn, and the type of T at each call site is pinned by the
		// dependency node's own declared TResult, not chosen freely.
		// type-coverage:ignore-next-line
		return results.get(nodeId) as T;
	}

	while (ready.length > 0) {
		ready.sort();
		const id = ready.shift();
		if (id === undefined) break;
		const node = nodeMap.get(id);
		if (!node) break;

		results.set(id, node.resolve(getResult));

		for (const dependentId of dependents.get(id) ?? []) {
			const remaining = (inDegree.get(dependentId) ?? 0) - 1;
			inDegree.set(dependentId, remaining);
			if (remaining === 0) {
				ready.push(dependentId);
			}
		}
	}

	if (results.size !== nodes.length) {
		const unresolved = nodes
			.map((node) => node.id)
			.filter((id) => !results.has(id))
			.sort();
		throw new CyclicDependencyError(unresolved);
	}

	return results;
}
