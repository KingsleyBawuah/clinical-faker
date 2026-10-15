import type { Provider } from "../../entities/types.ts";
import { humanName, identifier } from "../datatypes.ts";
import type { Practitioner } from "../types.ts";

export function buildPractitioner(provider: Provider): Practitioner {
	return {
		resourceType: "Practitioner",
		id: provider.id,
		identifier: [identifier(provider.identifier)],
		name: [humanName(provider.firstName, provider.lastName)],
	};
}
