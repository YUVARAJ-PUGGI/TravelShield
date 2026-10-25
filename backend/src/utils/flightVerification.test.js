import test from "node:test";
import assert from "node:assert/strict";
import {
  createFlightVerificationToken,
  readFlightVerificationToken,
  verifyFlightDetails,
} from "./flightVerification.js";

const secret = "test-secret-for-flight-verification";

test("flight verification requires a valid flight number and date", async () => {
  const invalidNumber = await verifyFlightDetails(
    { flightNumber: "?", flightDate: "2026-10-25" },
    { apiKey: "test", tokenSecret: secret, fetchImpl: async () => { throw new Error("should not call provider"); } }
  );
  assert.equal(invalidNumber.verificationStatus, "INVALID_INPUT");

  const invalidDate = await verifyFlightDetails(
    { flightNumber: "QR572", flightDate: "2026-02-30" },
    { apiKey: "test", tokenSecret: secret, fetchImpl: async () => { throw new Error("should not call provider"); } }
  );
  assert.equal(invalidDate.verificationStatus, "INVALID_INPUT");
});

test("provider errors route to manual review instead of a rejection", async () => {
  const result = await verifyFlightDetails(
    { flightNumber: "QR572", flightDate: "2026-10-25" },
    { apiKey: "test", tokenSecret: secret, fetchImpl: async () => ({ ok: true, json: async () => ({ error: { code: "function_access_restricted" } }) }) }
  );
  assert.equal(result.success, true);
  assert.equal(result.verificationStatus, "MANUAL_REVIEW");
  assert.equal(result.requiresManualReview, true);
  assert.ok(result.flightVerificationToken);
});

test("records are matched by both flight number and flight date", async () => {
  const result = await verifyFlightDetails(
    { flightNumber: "QR 572", flightDate: "2026-10-25" },
    {
      apiKey: "test",
      tokenSecret: secret,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ data: [{
          flight: { iata: "QR572" },
          flight_date: "2026-10-25",
          departure: { iata: "DOH" },
          arrival: { iata: "LHR" },
        }] }),
      }),
    }
  );
  assert.equal(result.verificationStatus, "RECORD_FOUND");
  assert.equal(result.flights[0].flightNumber, "QR572");
});

test("flight verification tokens are signed and bound to their input", () => {
  const token = createFlightVerificationToken({
    searchedFlightNumber: "QR572",
    searchedFlightDate: "2026-10-25",
    verificationStatus: "RECORD_FOUND",
    flights: [],
  }, secret);
  assert.ok(readFlightVerificationToken(token, { flightNumber: "QR572", flightDate: "2026-10-25" }, secret));
  assert.equal(readFlightVerificationToken(token, { flightNumber: "QR572", flightDate: "2026-10-26" }, secret), null);
  assert.equal(readFlightVerificationToken(`${token}x`, { flightNumber: "QR572", flightDate: "2026-10-25" }, secret), null);
});