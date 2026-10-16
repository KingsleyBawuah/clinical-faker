import { UnknownArchetypeError } from "../core/errors.ts";
import type { ArchetypeDefinition } from "./types.ts";

/**
 * Returns a definition object as-is, or looks a name up in `registry`. Only
 * own keys resolve, so inherited names like `"toString"` or `"__proto__"`
 * throw `UnknownArchetypeError` rather than returning a prototype member.
 */
export function resolveArchetype(
	archetype: string | ArchetypeDefinition,
	registry: Readonly<Record<string, ArchetypeDefinition>>,
): ArchetypeDefinition {
	if (typeof archetype !== "string") return archetype;
	const definition = Object.hasOwn(registry, archetype)
		? registry[archetype]
		: undefined;
	if (definition === undefined) {
		throw new UnknownArchetypeError(archetype, Object.keys(registry));
	}
	return definition;
}
