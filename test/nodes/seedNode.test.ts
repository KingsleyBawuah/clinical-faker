import { describe, expect, test } from "bun:test";
import { createMulberry32 } from "../../src/core/prng/mulberry32.ts";
import { createSeedNode } from "../../src/nodes/seedNode.ts";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

describe("createSeedNode", () => {
	test("has id 'seed' and no dependencies", () => {
		const node = createSeedNode(createMulberry32(1));
		expect(node.id).toBe("seed");
		expect(node.dependsOn).toEqual([]);
	});

	const unusedGetResult = () => {
		throw new Error("seedNode has no dependencies to read");
	};

	test("produces a seeded-UUID-shaped patientId and an ISO-date referenceDate", () => {
		const node = createSeedNode(createMulberry32(1));
		const result = node.resolve(unusedGetResult);

		expect(result.patientId).toMatch(UUID_PATTERN);
		expect(result.referenceDate).toMatch(ISO_DATE_PATTERN);
	});

	test("is deterministic: same seed produces the same result", () => {
		const nodeA = createSeedNode(createMulberry32(42));
		const nodeB = createSeedNode(createMulberry32(42));

		expect(nodeA.resolve(unusedGetResult)).toEqual(
			nodeB.resolve(unusedGetResult),
		);
	});

	test("honors an explicit referenceDate override instead of deriving one", () => {
		const node = createSeedNode(createMulberry32(1), "1999-12-31");
		const result = node.resolve(unusedGetResult);

		expect(result.referenceDate).toBe("1999-12-31");
	});
});
