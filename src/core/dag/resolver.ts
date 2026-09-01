import {
	CyclicDependencyError,
	DependencyNotReadyError,
	DuplicateNodeIdError,
	UnresolvedDependencyError,
} from "../errors.ts";
import type { DAGNode, NodeId } from "./types.ts";

/**
 * Reads one node's result out of the type-erased map `resolveDAG` returns.
 * This is the one place that erasure has to be reversed, so it carries the
 * single `as T` this codebase allows — see docs/architecture.md's "DAG
 * resolution engine" for why the resolver stays type-erased internally, and
 * why that reversal is sound despite `type-coverage --strict` flagging every
 * `as` assertion with no exceptions.
 */
export function getNodeResult<T>(
	results: ReadonlyMap<NodeId, unknown>,
	nodeId: NodeId,
): T {
	if (!results.has(nodeId)) {
		throw new DependencyNotReadyError(nodeId);
	}
	// type-coverage:ignore-next-line
	return results.get(nodeId) as T;
}

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
		return getNodeResult<T>(results, nodeId);
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
