import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(repoRoot, "dist");

function assertDistFileExists(relativePath) {
  assert.ok(
    existsSync(path.join(distRoot, relativePath)),
    `dist asset is missing: ${relativePath}`,
  );
}

function getStaticImports(filePath) {
  const source = readFileSync(filePath, "utf8");
  return Array.from(source.matchAll(/import\s+["']\.\/([^"']+)["']/g)).map(
    (match) => match[1],
  );
}

test("built manifest and service worker reference existing dist assets", (t) => {
  // This one asserts against build output, so on a clean checkout there is
  // nothing to check yet. Skip rather than fail — `npm test` should be usable
  // without remembering to build first.
  if (!existsSync(path.join(distRoot, "manifest.json"))) {
    t.skip("no dist/ output — run `npm run build` first");
    return;
  }

  const manifest = JSON.parse(
    readFileSync(path.join(distRoot, "manifest.json"), "utf8"),
  );

  const serviceWorkerPath = manifest.background?.service_worker;
  assert.equal(typeof serviceWorkerPath, "string");
  assertDistFileExists(serviceWorkerPath);

  for (const importedPath of getStaticImports(
    path.join(distRoot, serviceWorkerPath),
  )) {
    assertDistFileExists(importedPath);
  }

  for (const resourceGroup of manifest.web_accessible_resources ?? []) {
    for (const resource of resourceGroup.resources ?? []) {
      if (resource.includes("*")) continue;
      assertDistFileExists(resource);
    }
  }
});
