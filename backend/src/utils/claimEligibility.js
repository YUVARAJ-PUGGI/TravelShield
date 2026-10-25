import { normalizeClaimDate, validatePolicyEligibility } from "./claimValidation.js";
import { normalizeEvidenceChecklist } from "./planBenefitValidation.js";

function parseTerms(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function evaluateClaimEligibility({
  policy,
  benefit,
  incidentDate,
  claimedAmount,
  verification,
  hasTicket,
  supportingDocumentCount,
  referenceDate,
}) {
  const reasons = [];
  const policyMessage = validatePolicyEligibility(policy, incidentDate, referenceDate);
  if (policyMessage) {
    const normalizedIncidentDate = normalizeClaimDate(incidentDate);
    const coverageStart = normalizeClaimDate(policy?.coverage_start_date);
    const coverageEnd = normalizeClaimDate(policy?.coverage_end_date);
    reasons.push({
      code: "POLICY_COVERAGE",
      message: policyMessage,
      condition: normalizedIncidentDate && coverageStart && coverageEnd
        ? `Submitted incident date: ${normalizedIncidentDate}. Coverage period: ${coverageStart} to ${coverageEnd}.`
        : "An active issued policy and valid date within its coverage period are required.",
    });
  }

  if (!benefit || Number(benefit.plan_id) !== Number(policy?.plan_id)) {
    reasons.push({ code: "BENEFIT_NOT_AVAILABLE", message: "Select an active benefit included in this simulated policy's plan." });
  }

  const amount = Number(claimedAmount);
  const currencyMismatch = Boolean(
    benefit?.currency_code &&
    policy?.currency_code &&
    benefit.currency_code !== policy.currency_code
  );
  if (!Number.isFinite(amount) || amount < 0) {
    reasons.push({ code: "INVALID_AMOUNT", message: "Enter a valid non-negative claimed amount." });
  } else if (!currencyMismatch && benefit?.benefit_limit !== null && benefit?.benefit_limit !== undefined && amount > Number(benefit.benefit_limit)) {
    reasons.push({
      code: "BENEFIT_LIMIT",
      message: `The entered amount exceeds the ${benefit.benefit_name} illustrative benefit limit of ${benefit.currency_code} ${Number(benefit.benefit_limit).toFixed(2)}.`,
      condition: `Benefit limit: ${benefit.currency_code} ${Number(benefit.benefit_limit).toFixed(2)}.`,
    });
  }

  if (!currencyMismatch && Number.isFinite(amount) && policy?.coverage_amount != null && amount > Number(policy.coverage_amount)) {
    reasons.push({
      code: "POLICY_LIMIT",
      message: `The entered amount exceeds the plan's overall illustrative limit of ${policy.currency_code} ${Number(policy.coverage_amount).toFixed(2)}.`,
      condition: `Overall plan limit: ${policy.currency_code} ${Number(policy.coverage_amount).toFixed(2)}.`,
    });
  }

  if (!hasTicket) {
    reasons.push({ code: "TICKET_REQUIRED", message: "Upload the flight ticket as a PDF, JPG, or PNG before submitting." });
  }

  let requiredEvidence = [];
  if (benefit) {
    try {
      requiredEvidence = normalizeEvidenceChecklist(benefit.required_evidence);
    } catch {
      reasons.push({ code: "EVIDENCE_RULES_UNAVAILABLE", message: "The plan's required-document checklist could not be read. Contact support for manual review." });
    }
  }
  const suppliedCount = Number.isInteger(supportingDocumentCount) ? supportingDocumentCount : 0;
  if (requiredEvidence.length > suppliedCount) {
    const missingCount = requiredEvidence.length - suppliedCount;
    reasons.push({
      code: "MORE_EVIDENCE_REQUIRED",
      message: `Upload ${missingCount} more supporting ${missingCount === 1 ? "document" : "documents"} from the required checklist.`,
      missingEvidence: requiredEvidence.slice(suppliedCount),
    });
  }

  const definiteFailure = reasons.some(({ code }) => [
    "POLICY_COVERAGE",
    "BENEFIT_NOT_AVAILABLE",
    "INVALID_AMOUNT",
    "BENEFIT_LIMIT",
    "POLICY_LIMIT",
    "TICKET_REQUIRED",
    "MORE_EVIDENCE_REQUIRED",
    "EVIDENCE_RULES_UNAVAILABLE",
  ].includes(code));
  if (definiteFailure) {
    return {
      eligibleToSubmit: false,
      eligibilityStatus: "MORE_INFORMATION",
      reasons,
      requiredEvidence,
      policyConditions: parseTerms(policy?.policy_conditions),
      benefitExclusions: benefit?.exclusions_conditions || "",
    };
  }

  const policyExclusions = parseTerms(policy?.exclusions).map((exclusion) => ({
    title: `Exclusion: ${exclusion.title || "Policy exclusion"}`,
    description: exclusion.description || "This exclusion requires manual review.",
  }));
  const policyConditions = [...parseTerms(policy?.policy_conditions), ...policyExclusions];
  const hasUnconfiguredTerms =
    !verification ||
    verification.verificationStatus !== "RECORD_FOUND" ||
    currencyMismatch ||
    policyExclusions.length > 0 ||
    policyConditions.some((condition) => /proposed|not configured|provisional/i.test(`${condition.title || ""} ${condition.description || ""}`)) ||
    Boolean(benefit?.exclusions_conditions?.trim());

  return {
    eligibleToSubmit: true,
    eligibilityStatus: hasUnconfiguredTerms ? "MANUAL_REVIEW" : "READY_TO_SUBMIT",
    reasons: hasUnconfiguredTerms
      ? [{
          code: currencyMismatch
            ? "CURRENCY_REVIEW_REQUIRED"
            : verification?.verificationStatus === "RECORD_FOUND"
              ? "POLICY_REVIEW_REQUIRED"
              : "FLIGHT_REVIEW_REQUIRED",
          message: currencyMismatch
            ? "The benefit and policy use different currencies. No conversion is configured, so the amount needs manual review."
            : verification?.verificationStatus === "RECORD_FOUND"
              ? "Configured checks passed, but the policy conditions or exclusions require a human review."
              : "Configured policy checks passed, but the flight record could not be confirmed automatically. Submit for manual review.",
        }]
      : [],
    requiredEvidence,
    policyConditions,
    benefitExclusions: benefit?.exclusions_conditions || "",
  };
}