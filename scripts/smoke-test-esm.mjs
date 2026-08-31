// Confirms the built package actually loads under plain Node (not Bun), backing up the
// README's cross-package-manager compatibility claim. Run after `bun run build`.
const mod = await import("../dist/index.js");

if (typeof mod !== "object" || mod === null) {
	throw new Error(`unexpected export shape from dist/index.js: ${typeof mod}`);
}

console.log("Node ESM smoke test passed.");
