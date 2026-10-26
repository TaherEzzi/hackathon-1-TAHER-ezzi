import assert from "node:assert/strict";
import test from "node:test";
import { resolveTheme } from "./theme.js";

test("light is the default theme", () => {
  assert.equal(resolveTheme(null), "light");
  assert.equal(resolveTheme(undefined), "light");
  assert.equal(resolveTheme("light"), "light");
  assert.equal(resolveTheme("nope"), "light");
});

test("dark is selected only when the stored value is dark", () => {
  assert.equal(resolveTheme("dark"), "dark");
});
