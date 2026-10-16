import { AdultHypertension } from "./adultHypertension.ts";
import type { ArchetypeDefinition } from "./types.ts";

/** Every built-in archetype, keyed by the name `GenerationOptions.archetype` will accept. */
export const ARCHETYPES = {
	AdultHypertension,
} as const satisfies Readonly<Record<string, ArchetypeDefinition>>;

export type ArchetypeName = keyof typeof ARCHETYPES;
