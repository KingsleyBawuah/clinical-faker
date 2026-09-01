import { describe, expect, test } from "bun:test";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import { generateMessageControlId } from "../../src/hl7/messageControlId.ts";

const HEX_16_PATTERN = /^[0-9a-f]{16}$/;

describe("generateMessageControlId", () => {
	test("produces 16 lowercase hex characters — well within MSH-10's 20-character maximum", () => {
		const id = generateMessageControlId(createMulberry32(42));
		expect(id).toMatch(HEX_16_PATTERN);
		expect(id.length).toBeLessThanOrEqual(20);
	});

	test("is deterministic: the same PRNG seed produces the same control id", () => {
		const a = generateMessageControlId(createMulberry32(7));
		const b = generateMessageControlId(createMulberry32(7));
		expect(a).toBe(b);
	});

	test("different seeds produce different control ids", () => {
		const a = generateMessageControlId(createMulberry32(1));
		const b = generateMessageControlId(createMulberry32(2));
		expect(a).not.toBe(b);
	});
});
