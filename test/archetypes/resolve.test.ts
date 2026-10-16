import { describe, expect, test } from "bun:test";
import { resolveArchetype } from "../../src/archetypes/resolve.ts";
import type { ArchetypeDefinition } from "../../src/archetypes/types.ts";
import {
	ClinicalFakerError,
	UnknownArchetypeError,
} from "../../src/core/errors.ts";

// Structural fixtures only — not real clinical content.
const EMPTY_DEFINITION: ArchetypeDefinition = {
	conditions: [],
	observations: [],
	medications: [],
};

const OTHER_DEFINITION: ArchetypeDefinition = {
	conditions: [{ code: "X00", display: "Test condition", probability: 1 }],
	observations: [],
	medications: [],
};

const REGISTRY: Readonly<Record<string, ArchetypeDefinition>> = {
	Alpha: EMPTY_DEFINITION,
	Beta: OTHER_DEFINITION,
};

describe("resolveArchetype", () => {
	test("returns a definition object as-is, without consulting the registry", () => {
		const custom: ArchetypeDefinition = {
			conditions: [],
			observations: [],
			medications: [],
		};

		expect(resolveArchetype(custom, REGISTRY)).toBe(custom);
		expect(resolveArchetype(custom, {})).toBe(custom);
	});

	test("looks up a known name in the registry", () => {
		expect(resolveArchetype("Alpha", REGISTRY)).toBe(EMPTY_DEFINITION);
		expect(resolveArchetype("Beta", REGISTRY)).toBe(OTHER_DEFINITION);
	});

	test("throws UnknownArchetypeError for a name not in the registry", () => {
		expect(() => resolveArchetype("Gamma", REGISTRY)).toThrow(
			UnknownArchetypeError,
		);
	});

	test("the thrown error is a ClinicalFakerError carrying the name and valid names", () => {
		let caught: unknown;
		try {
			resolveArchetype("Gamma", REGISTRY);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(ClinicalFakerError);
		expect(caught).toBeInstanceOf(UnknownArchetypeError);
		if (!(caught instanceof UnknownArchetypeError)) return;
		expect(caught.archetype).toBe("Gamma");
		expect(caught.validNames).toEqual(["Alpha", "Beta"]);
	});

	test.each([
		"toString",
		"__proto__",
		"constructor",
		"hasOwnProperty",
		"valueOf",
	])("does not resolve inherited prototype key %p", (key) => {
		expect(() => resolveArchetype(key, REGISTRY)).toThrow(
			UnknownArchetypeError,
		);
	});

	test("lookup is case-sensitive", () => {
		expect(() => resolveArchetype("alpha", REGISTRY)).toThrow(
			UnknownArchetypeError,
		);
	});
});
