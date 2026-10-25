import crypto from "node:crypto";

const verificationTokenLifetime = 15 * 60 * 1000;

function isDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function signPayload(encodedPayload, secret) {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createFlightVerificationToken(result, secret = process.env.AUTH_SECRET) {
  if (!secret) throw new Error("AUTH_SECRET is required to sign flight verification results.");
  const payload = Buffer.from(JSON.stringify({
    flightNumber: result.searchedFlightNumber,
    flightDate: result.searchedFlightDate,
    verificationStatus: result.verificationStatus,
    matchingFlight: result.flights?.[0] || null,
    expiresAt: Date.now() + verificationTokenLifetime,
  })).toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

export function readFlightVerificationToken(token, expectedFlight, secret = process.env.AUTH_SECRET) {
  if (!secret || typeof token !== "string") return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  const expectedSignature = Buffer.from(signPayload(payload, secret));
  const suppliedSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== suppliedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, suppliedSignature)
  ) return null;

  try {
    const result = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      result.expiresAt < Date.now() ||
      result.flightNumber !== expectedFlight.flightNumber.trim().toUpperCase() ||
      result.flightDate !== expectedFlight.flightDate
    ) return null;
    return result;
  } catch {
    return null;
  }
}

function createResult(flightNumber, flightDate, status, message, flights = [], secret) {
  const result = {
    success: true,
    verificationStatus: status,
    message,
    searchedFlightNumber: flightNumber,
    searchedFlightDate: flightDate,
    totalRecords: flights.length,
    flights,
    requiresManualReview: status === "MANUAL_REVIEW",
  };
  result.flightVerificationToken = createFlightVerificationToken(result, secret);
  return result;
}

function normalizeProviderFlight(flight) {
  return {
    flightNumber: flight.flight?.iata || null,
    flightDate: flight.flight_date ? String(flight.flight_date).slice(0, 10) : null,
    flightStatus: flight.flight_status || "unknown",
    departureAirport: flight.departure?.airport || null,
    departureIata: flight.departure?.iata || null,
    departureScheduled: flight.departure?.scheduled || null,
    departureActual: flight.departure?.actual || null,
    departureDelayMinutes: flight.departure?.delay ?? null,
    arrivalAirport: flight.arrival?.airport || null,
    arrivalIata: flight.arrival?.iata || null,
    arrivalScheduled: flight.arrival?.scheduled || null,
    arrivalActual: flight.arrival?.actual || null,
    arrivalDelayMinutes: flight.arrival?.delay ?? null,
  };
}

export async function verifyFlightDetails(input, {
  fetchImpl = fetch,
  apiKey = process.env.AVIATIONSTACK_API_KEY,
  tokenSecret = process.env.AUTH_SECRET,
} = {}) {
  const flightNumber = typeof input?.flightNumber === "string"
    ? input.flightNumber.trim().toUpperCase()
    : "";
  const flightDate = input?.flightDate;
  if (!/^[A-Z0-9]{2,3}\s?\d{1,5}[A-Z]?$/.test(flightNumber)) {
    return { success: false, statusCode: 400, verificationStatus: "INVALID_INPUT", message: "Enter a valid flight number, such as QR572." };
  }
  if (!isDateOnly(flightDate)) {
    return { success: false, statusCode: 400, verificationStatus: "INVALID_INPUT", message: "Flight date must be a valid date in YYYY-MM-DD format." };
  }

  const manualReview = (message) => createResult(flightNumber, flightDate, "MANUAL_REVIEW", message, [], tokenSecret);
  if (!apiKey || /YOUR_REGENERATED_API_KEY|your_actual_key_here/i.test(apiKey)) {
    return manualReview("Live flight verification is not configured. The ticket and flight details will need manual review.");
  }

  const params = new URLSearchParams({
    access_key: apiKey.trim(),
    flight_iata: flightNumber.replace(/\s/g, ""),
    flight_date: flightDate,
  });

  try {
    const response = await fetchImpl(
      `https://api.aviationstack.com/v1/flights?${params.toString()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await response.json();
    if (!response.ok || data.error) {
      console.error("Aviationstack verification unavailable:", data.error?.code || response.status);
      return manualReview("Live verification is unavailable on the current provider configuration. Continue with manual review.");
    }

    const flights = Array.isArray(data.data) ? data.data.map(normalizeProviderFlight) : [];
    const matchingFlight = flights.find((flight) =>
      flight.flightNumber?.replace(/\s/g, "").toUpperCase() === flightNumber.replace(/\s/g, "") &&
      flight.flightDate === flightDate
    );
    if (!matchingFlight) {
      return createResult(
        flightNumber,
        flightDate,
        "MANUAL_REVIEW",
        "No exact flight number and date match was found. The uploaded ticket can be reviewed manually.",
        flights,
        tokenSecret
      );
    }
    return createResult(
      flightNumber,
      flightDate,
      "RECORD_FOUND",
      "A matching flight record was found. It supports review but does not prove the event or claim eligibility.",
      [matchingFlight],
      tokenSecret
    );
  } catch (error) {
    console.error("Aviationstack request failed:", error.message);
    return manualReview("Live flight verification is unavailable. Continue with manual review using the uploaded ticket.");
  }
}