import test from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = "test-only-stable-auth-secret";

const { createAuthToken, requireAuth } = await import("./auth.js");

test("creates a token that can be verified with the configured secret", () => {
  const token = createAuthToken(42);
  const request = {
    get(name) {
      return name === "authorization" ? `Bearer ${token}` : undefined;
    },
  };
  const response = {
    status() {
      throw new Error("Expected the token to be accepted.");
    },
    json() {
      throw new Error("Expected the token to be accepted.");
    },
  };
  let nextCalled = false;

  requireAuth(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(request.user, { userId: 42 });
});

test("rejects requests without a bearer token", () => {
  const request = {
    get() {
      return "";
    },
  };
  let statusCode;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
    },
  };

  requireAuth(request, response, () => {
    throw new Error("Expected authentication to be required.");
  });

  assert.equal(statusCode, 401);
  assert.equal(responseBody.success, false);
});
