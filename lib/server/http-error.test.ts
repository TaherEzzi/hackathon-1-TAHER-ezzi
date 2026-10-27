import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HttpError, isUnauthorized, unauthorized } from "./http-error";

describe("HttpError", () => {
  it("isUnauthorized recognizes unauthorized throws", () => {
    try {
      unauthorized();
    } catch (error) {
      assert.equal(isUnauthorized(error), true);
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 401);
      return;
    }
    assert.fail("expected unauthorized() to throw");
  });

  it("isUnauthorized rejects other errors", () => {
    assert.equal(isUnauthorized(new HttpError("forbidden", 403, "forbidden")), false);
    assert.equal(isUnauthorized(new Error("nope")), false);
  });
});
