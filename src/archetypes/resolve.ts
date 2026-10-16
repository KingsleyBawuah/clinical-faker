import {
	InvalidArchetypeError,
	UnknownArchetypeError,
} from "../core/errors.ts";
import type { ArchetypeDefinition } from "./types.ts";

/** `typeof`, but naming `null` and arrays separately so the error says what was actually passed. */
function describeType(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

/**
 * Returns a definition object as-is, or looks a name up in `registry`. Only
 * own keys resolve, so inherited names like `"toString"` or `"__proto__"`
 * throw `UnknownArchetypeError` rather than returning a prototype member.
 * Anything that's neither a string nor a non-array object (only reachable
 * from plain JS) throws `InvalidArchetypeError`.
 */
export function resolveArchetype(
	archetype: string | ArchetypeDefinition,
	registry: Readonly<Record<string, ArchetypeDefinition>>,
): ArchetypeDefinition {
	if (typeof archetype !== "string") {
		const type = describeType(archetype);
		if (type !== "object") throw new InvalidArchetypeError(type);
		return archetype;
	}
	const definition = Object.hasOwn(registry, archetype)
		? registry[archetype]
		: undefined;
	if (definition === undefined) {
		throw new UnknownArchetypeError(archetype, Object.keys(registry));
	}
	return definition;
}
