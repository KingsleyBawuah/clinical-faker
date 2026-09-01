import type { AllergyEntity } from "../../entities/types.ts";
import { ce } from "../composites.ts";
import { toHL7AllergySeverity } from "../mappings/allergySeverity.ts";
import type { HL7Segment } from "../types.ts";
import { buildSegmentFromFields } from "./buildSegmentFromFields.ts";

/**
 * Builds an `AL1` segment from an `AllergyEntity`. `setId` is 1-based.
 * `AL1-2` (Allergen Type Code — drug/food/environmental) has no equivalent
 * in this library's `AllergyEntity` model and is left empty, the same
 * treatment as `XAD`'s "other designation"/`CX`'s check-digit components
 * elsewhere in this codebase. `AL1-3` (Allergen Code/Description) is
 * always uncoded (empty identifier component) since `substance` is free
 * text with no RxNorm/SNOMED code in the IR — valid per the spec, not a
 * gap this builder needs to work around.
 */
export function buildAL1Segment(
	allergy: AllergyEntity,
	setId: number,
): HL7Segment {
	return buildSegmentFromFields("AL1", {
		1: String(setId),
		3: ce("", allergy.substance, ""),
		...(allergy.criticality === undefined
			? {}
			: { 4: toHL7AllergySeverity(allergy.criticality) }),
		...(allergy.reaction === undefined ? {} : { 5: allergy.reaction }),
	});
}
