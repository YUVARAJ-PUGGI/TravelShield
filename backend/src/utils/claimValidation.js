import { normalizeDateOnly } from "./dateOnly.js";

const maximumDescriptionLength = 2000;
const maximumClaimedAmount = 9999999999.99;
const claimsTimeZone = "Asia/Kolkata";

export function getDateOnlyInTimeZone(date, timeZone = claimsTimeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type === "year" || type === "month" || type === "day")
      .map(({ type, value }) => [type, value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function getTodayDateOnly(referenceDate = new Date()) {
  return getDateOnlyInTimeZone(referenceDate);
}

export function normalizeClaimDate(value) {
  if (typeof value === "string") return normalizeDateOnly(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return getDateOnlyInTimeZone(value);
  }
  return null;
}

export function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function validateClaimInput({ policy_id, incident_date, description, claimed_amount }) {
  const policyId = parsePositiveInteger(policy_id);
  if (!policyId) return { message: "A valid policy ID is required." };

  const incidentDate = normalizeDateOnly(incident_date);
  if (!incidentDate) {
    return { message: "The incident date must be valid and use YYYY-MM-DD format." };
  }

  if (
    typeof description !== "string" ||
    description.trim().length < 10 ||
    description.trim().length > maximumDescriptionLength
  ) {
    return {
      message: `Description must be between 10 and ${maximumDescriptionLength} characters.`,
    };
  }

  const claimedAmount = Number(claimed_amount);
  if (
    !Number.isFinite(claimedAmount) ||
    claimedAmount < 0 ||
    claimedAmount > maximumClaimedAmount ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(claimed_amount).trim())
  ) {
    return { message: "Claimed amount must be a valid non-negative amount with up to two decimals." };
  }

  return {
    policyId,
    incidentDate,
    description: description.trim(),
    claimedAmount: Number(claimedAmount.toFixed(2)),
  };
}

export function validatePolicyEligibility(
  policy,
  incidentDate,
  referenceDate = new Date()
) {
  if (!policy || policy.policy_status !== "simulated_issued") {
    return "Claims can only be submitted against an issued simulated policy.";
  }

  const normalizedIncidentDate = normalizeClaimDate(incidentDate);
  if (!normalizedIncidentDate) {
    return "The incident date must be valid and use YYYY-MM-DD format.";
  }

  const today = getTodayDateOnly(referenceDate);
  if (normalizedIncidentDate > today) {
    return "The incident date cannot be in the future.";
  }

  const coverageStart = normalizeClaimDate(policy.coverage_start_date);
  const coverageEnd = normalizeClaimDate(policy.coverage_end_date);
  if (
    !coverageStart ||
    !coverageEnd ||
    normalizedIncidentDate < coverageStart ||
    normalizedIncidentDate > coverageEnd
  ) {
    return "The incident date must fall within the simulated policy coverage dates.";
  }

  return null;
}
