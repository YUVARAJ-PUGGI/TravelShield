const allowedDecisions = new Set(["approved_demo", "declined_demo"]);

export function validateClaimReviewInput(input = {}) {
  const decision = typeof input.decision === "string" ? input.decision : "";
  if (!allowedDecisions.has(decision)) {
    return { message: "Decision must be approved_demo or declined_demo." };
  }

  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length < 10 || notes.length > 2000) {
    return { message: "Review notes must be between 10 and 2000 characters." };
  }

  return { decision, notes };
}

export function validateEvidenceReviewInput(input = {}) {
  const status = typeof input.status === "string" ? input.status : "";
  if (!["verified", "needs_correction"].includes(status)) {
    return { message: "Evidence status must be verified or needs_correction." };
  }
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (status === "needs_correction" && (notes.length < 5 || notes.length > 1000)) {
    return { message: "Explain what needs correction in 5 to 1000 characters." };
  }
  if (notes.length > 1000) return { message: "Evidence review notes cannot exceed 1000 characters." };
  return { status, notes };
}