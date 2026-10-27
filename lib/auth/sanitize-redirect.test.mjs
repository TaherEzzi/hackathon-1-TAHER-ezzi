import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAuthRedirect } from "./sanitize-redirect.mjs";

test("sanitizeAuthRedirect allows same-origin relative paths", () => {
  assert.equal(sanitizeAuthRedirect("/trip-dossier.html"), "/trip-dossier.html");
});

test("sanitizeAuthRedirect rejects open redirects", () => {
  assert.equal(sanitizeAuthRedirect("https://evil.test"), "/the-house.html");
  assert.equal(sanitizeAuthRedirect("//evil.test"), "/the-house.html");
  assert.equal(sanitizeAuthRedirect(null), "/the-house.html");
});
