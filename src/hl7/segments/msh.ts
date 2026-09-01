import { InvalidMessageControlIdError } from "../../core/errors.ts";
import type { HL7Delimiters, HL7Segment, HL7Value } from "../types.ts";
import { STANDARD_HL7_DELIMITERS } from "../types.ts";
import { HL7_VERSION } from "../version.ts";
import { buildSegmentFromFields } from "./buildSegmentFromFields.ts";

const MSH_10_MAX_LENGTH = 20;

export interface MSHFields {
	sendingApplication: string;
	sendingFacility: string;
	receivingApplication: string;
	receivingFacility: string;
	/** Already `toDTM`-formatted. */
	dateTime: string;
	/** `MSH-9`, composed by the caller — e.g. `["ADT", "A01", "ADT_A01"]` wrapped as an `HL7Value`. Message-type-specific, so this builder doesn't decide it. */
	messageType: HL7Value;
	messageControlId: string;
	processingId: "P" | "T" | "D";
	versionId?: string;
	delimiters?: HL7Delimiters;
}

/**
 * Builds an `MSH` segment. `MSH-1`/`MSH-2` are derived directly from
 * `delimiters` rather than hardcoded, so they can never drift out of sync
 * with what `serializeMessage()` actually uses to join the rest of the
 * message — see docs/architecture.md's "HL7 v2 serialization" section.
 */
export function buildMSHSegment(fields: MSHFields): HL7Segment {
	if (fields.messageControlId.length > MSH_10_MAX_LENGTH) {
		throw new InvalidMessageControlIdError(fields.messageControlId);
	}
	const delimiters = fields.delimiters ?? STANDARD_HL7_DELIMITERS;
	const encodingCharacters = `${delimiters.component}${delimiters.repetition}${delimiters.escape}${delimiters.subcomponent}`;
	return buildSegmentFromFields("MSH", {
		1: delimiters.field,
		2: encodingCharacters,
		3: fields.sendingApplication,
		4: fields.sendingFacility,
		5: fields.receivingApplication,
		6: fields.receivingFacility,
		7: fields.dateTime,
		9: fields.messageType,
		10: fields.messageControlId,
		11: fields.processingId,
		12: fields.versionId ?? HL7_VERSION,
	});
}
