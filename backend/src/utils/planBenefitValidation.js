export function normalizeEvidenceChecklist(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== "string" || !item.trim())
  ) {
    throw new Error("Plan benefit evidence checklist is invalid.");
  }
  return parsed.map((item) => item.trim());
}

export function normalizePlanBenefitRows(rows) {
  if (!Array.isArray(rows)) {
    throw new Error("Plan benefit response is invalid.");
  }
  return rows.map((row) => ({
    ...row,
    required_evidence: normalizeEvidenceChecklist(row.required_evidence),
  }));
}
