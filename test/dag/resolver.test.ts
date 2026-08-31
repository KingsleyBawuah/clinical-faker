import { describe, expect, test } from "bun:test";
import { resolveDAG } from "../../src/core/dag/resolver.ts";
import type { DAGNode } from "../../src/core/dag/types.ts";
import {
	CyclicDependencyError,
	DependencyNotReadyError,
	DuplicateNodeIdError,
	UnresolvedDependencyError,
} from "../../src/core/errors.ts";

describe("resolveDAG", () => {
	test("resolves a linear chain in dependency order", () => {
		const order: string[] = [];
		const nodes: DAGNode<number>[] = [
			{
				id: "a",
				dependsOn: [],
				resolve: () => {
					order.push("a");
					return 1;
				},
			},
			{
				id: "b",
				dependsOn: ["a"],
				resolve: (getResult) => {
					order.push("b");
					return getResult<number>("a") + 1;
				},
			},
			{
				id: "c",
				dependsOn: ["b"],
				resolve: (getResult) => {
					order.push("c");
					return getResult<number>("b") + 1;
				},
			},
		];

		const results = resolveDAG(nodes);

		expect(order).toEqual(["a", "b", "c"]);
		expect(results.get("a")).toBe(1);
		expect(results.get("b")).toBe(2);
		expect(results.get("c")).toBe(3);
	});

	test("resolves a diamond dependency graph, passing each dependency's result to its dependents", () => {
		const order: string[] = [];
		const nodes: DAGNode[] = [
			{
				id: "seed",
				dependsOn: [],
				resolve: () => {
					order.push("seed");
					return 10;
				},
			},
			{
				id: "left",
				dependsOn: ["seed"],
				resolve: (getResult) => {
					order.push("left");
					return getResult<number>("seed") + 1;
				},
			},
			{
				id: "right",
				dependsOn: ["seed"],
				resolve: (getResult) => {
					order.push("right");
					return getResult<number>("seed") + 2;
				},
			},
			{
				id: "join",
				dependsOn: ["left", "right"],
				resolve: (getResult) => {
					order.push("join");
					return getResult<number>("left") + getResult<number>("right");
				},
			},
		];

		const results = resolveDAG(nodes);

		// "left" and "right" both become ready as soon as "seed" resolves —
		// ascending lexical tie-break means "left" runs before "right".
		expect(order).toEqual(["seed", "left", "right", "join"]);
		expect(results.get("join")).toBe(23);
	});

	test("breaks ties between simultaneously-ready nodes by ascending lexical id", () => {
		const order: string[] = [];
		const nodes: DAGNode<null>[] = ["c", "a", "b"].map((id) => ({
			id,
			dependsOn: [],
			resolve: () => {
				order.push(id);
				return null;
			},
		}));

		resolveDAG(nodes);

		expect(order).toEqual(["a", "b", "c"]);
	});

	test("throws UnresolvedDependencyError when a node depends on an id not in the graph", () => {
		const nodes: DAGNode[] = [
			{
				id: "a",
				dependsOn: ["missing"],
				resolve: () => null,
			},
		];

		expect(() => resolveDAG(nodes)).toThrow(UnresolvedDependencyError);
	});

	test("throws CyclicDependencyError for a direct cycle", () => {
		const nodes: DAGNode[] = [
			{ id: "a", dependsOn: ["b"], resolve: () => null },
			{ id: "b", dependsOn: ["a"], resolve: () => null },
		];

		expect(() => resolveDAG(nodes)).toThrow(CyclicDependencyError);
	});

	test("throws CyclicDependencyError for a longer cycle, without resolving any of its nodes", () => {
		const order: string[] = [];
		const nodes: DAGNode[] = [
			{
				id: "a",
				dependsOn: ["c"],
				resolve: () => {
					order.push("a");
					return null;
				},
			},
			{
				id: "b",
				dependsOn: ["a"],
				resolve: () => {
					order.push("b");
					return null;
				},
			},
			{
				id: "c",
				dependsOn: ["b"],
				resolve: () => {
					order.push("c");
					return null;
				},
			},
		];

		expect(() => resolveDAG(nodes)).toThrow(CyclicDependencyError);
		expect(order).toEqual([]);
	});

	test("resolves the non-cyclic part of a graph before detecting an unrelated cycle", () => {
		const order: string[] = [];
		const nodes: DAGNode[] = [
			{
				id: "standalone",
				dependsOn: [],
				resolve: () => {
					order.push("standalone");
					return "ok";
				},
			},
			{ id: "cycle-a", dependsOn: ["cycle-b"], resolve: () => null },
			{ id: "cycle-b", dependsOn: ["cycle-a"], resolve: () => null },
		];

		let thrown: unknown;
		try {
			resolveDAG(nodes);
		} catch (error) {
			thrown = error;
		}

		expect(order).toEqual(["standalone"]);
		if (!(thrown instanceof CyclicDependencyError)) {
			throw new Error("expected resolveDAG to throw CyclicDependencyError");
		}
		expect(thrown.nodeIds).toEqual(["cycle-a", "cycle-b"]);
	});

	test("throws DuplicateNodeIdError when two nodes share the same id", () => {
		const nodes: DAGNode[] = [
			{ id: "a", dependsOn: [], resolve: () => 1 },
			{ id: "a", dependsOn: [], resolve: () => 2 },
		];

		expect(() => resolveDAG(nodes)).toThrow(DuplicateNodeIdError);
	});

	test("throws when a node reads an undeclared dependency that hasn't resolved yet", () => {
		// "x" sorts before "y" lexically, so it resolves first; reading "y" here
		// (without declaring it in dependsOn) hits the internal guard rather than
		// silently returning a stale or wrong value.
		const nodes: DAGNode[] = [
			{
				id: "x",
				dependsOn: [],
				resolve: (getResult) => getResult<number>("y"),
			},
			{ id: "y", dependsOn: [], resolve: () => 42 },
		];

		expect(() => resolveDAG(nodes)).toThrow(DependencyNotReadyError);
	});
});
