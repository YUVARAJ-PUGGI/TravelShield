import crypto from "node:crypto";
import { Router } from "express";
import pool from "../config/db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { readEvidenceFile } from "../utils/evidenceStorage.js";
import { createUserNotification, storeUserDocument } from "../utils/documentRecords.js";
import { parsePositiveInteger } from "../utils/claimValidation.js";
import { validateClaimReviewInput, validateEvidenceReviewInput } from "../utils/claimReviewValidation.js";
import { calculateInvoiceTotals } from "../utils/billing.js";
import { createInvoicePdf } from "../utils/documentPdf.js";
import { validateEvidenceFile } from "../utils/evidenceStorage.js";

const router = Router();
router.use(requireAuth, requireAdmin);

async function rollbackSafely(connection) {
  try {
    await connection.rollback();
  } catch (error) {
    console.error("Failed to roll back admin claim review:", error.message);
  }
}

router.get("/", async (req, res) => {
  const requestedStatus = typeof req.query.status === "string" ? req.query.status : "review_queue";
  const queueStatuses = ["submitted", "under_review", "approved_demo", "declined_demo"];
  const allowedStatuses = ["review_queue", ...queueStatuses, "all"];
  if (!allowedStatuses.includes(requestedStatus)) {
    return res.status(400).json({ success: false, message: "Status must be review_queue, submitted, under_review, approved_demo, declined_demo, or all." });
  }
  const whereClause = requestedStatus === "all"
    ? ""
    : requestedStatus === "review_queue"
      ? "WHERE c.claim_status IN ('submitted', 'under_review')"
      : "WHERE c.claim_status = ?";
  const parameters = requestedStatus === "all" || requestedStatus === "review_queue" ? [] : [requestedStatus];
  try {
    const [rows] = await pool.query(
      `SELECT c.claim_id, c.claim_number, c.claim_status,
              DATE_FORMAT(c.incident_date, '%Y-%m-%d') AS incident_date,
              c.claimed_amount, c.currency_code, c.submitted_at,
              c.flight_number, DATE_FORMAT(c.flight_date, '%Y-%m-%d') AS flight_date,
              c.flight_verification_status, c.reviewed_at, c.review_notes,
              u.full_name AS claimant_name, u.email AS claimant_email,
              p.policy_number, pl.plan_name, pb.benefit_name,
              (SELECT COUNT(*) FROM claim_evidence_documents d WHERE d.claim_id = c.claim_id) AS evidence_count
       FROM claims c
       JOIN users u ON u.user_id = c.user_id
       JOIN policies p ON p.policy_id = c.policy_id
       JOIN quotes q ON q.quote_id = p.quote_id
       JOIN plans pl ON pl.plan_id = q.plan_id
       LEFT JOIN plan_benefits pb ON pb.benefit_id = c.benefit_id
       ${whereClause}
       ORDER BY CASE c.claim_status WHEN 'under_review' THEN 0 WHEN 'submitted' THEN 1 ELSE 2 END,
                c.submitted_at ASC`,
      parameters
    );
    return res.json({ success: true, count: rows.length, data: rows, educational_simulation: true });
  } catch (error) {
    console.error("Failed to load admin claim queue:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load the claim review queue." });
  }
});

router.get("/:claimId", async (req, res) => {
  const claimId = parsePositiveInteger(req.params.claimId);
  if (!claimId) return res.status(400).json({ success: false, message: "A valid claim ID is required." });
  try {
    const [claims] = await pool.query(
      `SELECT c.claim_id, c.claim_number, c.claim_status,
              DATE_FORMAT(c.incident_date, '%Y-%m-%d') AS incident_date,
              c.description, c.claimed_amount, c.currency_code, c.submitted_at,
              c.flight_number, DATE_FORMAT(c.flight_date, '%Y-%m-%d') AS flight_date,
              c.flight_verification_status, c.review_notes, c.reviewed_at,
              reviewer.full_name AS reviewer_name,
              claimant.full_name AS claimant_name, claimant.email AS claimant_email,
              p.policy_id, p.policy_number,
              DATE_FORMAT(p.coverage_start_date, '%Y-%m-%d') AS coverage_start_date,
              DATE_FORMAT(p.coverage_end_date, '%Y-%m-%d') AS coverage_end_date,
              pl.plan_name, pb.benefit_name, pb.required_evidence,
              pb.exclusions_conditions AS benefit_exclusions,
              pl.policy_conditions, pl.exclusions
       FROM claims c
       JOIN users claimant ON claimant.user_id = c.user_id
       LEFT JOIN users reviewer ON reviewer.user_id = c.reviewer_user_id
       JOIN policies p ON p.policy_id = c.policy_id
       JOIN quotes q ON q.quote_id = p.quote_id
       JOIN plans pl ON pl.plan_id = q.plan_id
       LEFT JOIN plan_benefits pb ON pb.benefit_id = c.benefit_id
       WHERE c.claim_id = ?`,
      [claimId]
    );
    if (!claims.length) return res.status(404).json({ success: false, message: "Claim not found." });
    const [documents] = await pool.query(
      `SELECT document_id, original_filename, mime_type, file_size,
              evidence_kind, evidence_label, review_status, review_notes,
              reviewed_at, created_at
       FROM claim_evidence_documents WHERE claim_id = ? ORDER BY created_at, document_id`,
      [claimId]
    );
    const [settlementInvoices] = await pool.query(
      `SELECT i.invoice_id, i.invoice_number, d.document_id
       FROM billing_invoices i
       LEFT JOIN user_documents d ON d.invoice_id = i.invoice_id AND d.user_id = i.user_id
       WHERE i.claim_id = ? ORDER BY i.invoice_id DESC LIMIT 1`,
      [claimId]
    );
    const settlementInvoice = settlementInvoices[0]
      ? {
          invoice_id: settlementInvoices[0].invoice_id,
          invoice_number: settlementInvoices[0].invoice_number,
          document_id: settlementInvoices[0].document_id,
        }
      : null;
    return res.json({ success: true, data: { ...claims[0], evidence: documents, settlement_invoice: settlementInvoice }, educational_simulation: true });
  } catch (error) {
    console.error("Failed to load admin claim detail:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load claim review details." });
  }
});

router.patch("/:claimId/documents/:documentId/review", async (req, res) => {
  const claimId = parsePositiveInteger(req.params.claimId);
  const documentId = parsePositiveInteger(req.params.documentId);
  if (!claimId || !documentId) {
    return res.status(400).json({ success: false, message: "Valid claim and document IDs are required." });
  }
  const validation = validateEvidenceReviewInput(req.body || {});
  if (validation.message) return res.status(400).json({ success: false, message: validation.message });

  try {
    const [result] = await pool.query(
      `UPDATE claim_evidence_documents d
       JOIN claims c ON c.claim_id = d.claim_id
       SET d.review_status = ?, d.review_notes = ?, d.reviewed_by = ?,
           d.reviewed_at = CURRENT_TIMESTAMP
       WHERE d.document_id = ? AND d.claim_id = ?
         AND c.claim_status IN ('submitted', 'under_review')`,
      [validation.status, validation.notes || null, req.user.userId, documentId, claimId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Pending claim evidence not found." });
    }
    return res.json({ success: true, message: "Evidence review status saved.", data: { document_id: documentId, review_status: validation.status } });
  } catch (error) {
    console.error("Failed to save evidence review:", error.message);
    return res.status(500).json({ success: false, message: "Unable to save evidence review." });
  }
});

router.get("/:claimId/documents/:documentId/download", async (req, res) => {
  const claimId = parsePositiveInteger(req.params.claimId);
  const documentId = parsePositiveInteger(req.params.documentId);
  if (!claimId || !documentId) {
    return res.status(400).json({ success: false, message: "Valid claim and document IDs are required." });
  }
  try {
    let rows = await pool.query(
      `SELECT d.original_filename, d.mime_type, d.storage_name
       FROM claim_evidence_documents d
       JOIN claims c ON c.claim_id = d.claim_id
       WHERE d.document_id = ? AND d.claim_id = ?`,
      [documentId, claimId]
    ).then(([result]) => result);
    if (!rows.length) {
      [rows] = await pool.query(
        `SELECT d.original_filename, d.mime_type, d.storage_name
         FROM user_documents d
         JOIN billing_invoices i ON i.invoice_id = d.invoice_id
         WHERE d.document_id = ? AND d.claim_id = ?`,
        [documentId, claimId]
      );
    }
    if (!rows.length) return res.status(404).json({ success: false, message: "Claim document not found." });
    const file = await readEvidenceFile(rows[0].storage_name);
    res.type(rows[0].mime_type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${rows[0].original_filename.replace(/["\\\r\n]/g, "_")}"`);
    return res.send(file.contents);
  } catch (error) {
    console.error("Failed to download claim review document:", error.message);
    return res.status(error.code === "ENOENT" ? 404 : 500).json({ success: false, message: "Unable to download claim document." });
  }
});

router.get("/:claimId/invoice/download", async (req, res) => {
  const claimId = parsePositiveInteger(req.params.claimId);
  if (!claimId) return res.status(400).json({ success: false, message: "A valid claim ID is required." });
  try {
    const [rows] = await pool.query(
      `SELECT d.original_filename, d.mime_type, d.storage_name
       FROM user_documents d
       JOIN billing_invoices i ON i.invoice_id = d.invoice_id
       WHERE i.claim_id = ? AND d.document_type IN ('claim_settlement_invoice', 'invoice')
       ORDER BY d.document_id DESC LIMIT 1`,
      [claimId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Claim settlement invoice not found." });
    const file = await readEvidenceFile(rows[0].storage_name);
    res.type(rows[0].mime_type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${rows[0].original_filename.replace(/["\\\r\n]/g, "_")}"`);
    return res.send(file.contents);
  } catch (error) {
    console.error("Failed to download claim settlement invoice:", error.message);
    return res.status(error.code === "ENOENT" ? 404 : 500).json({ success: false, message: "Unable to download claim settlement invoice." });
  }
});

router.get("/:claimId/invoices/:invoiceId/download", async (req, res) => {
  const claimId = parsePositiveInteger(req.params.claimId);
  const invoiceId = parsePositiveInteger(req.params.invoiceId);
  if (!claimId || !invoiceId) return res.status(400).json({ success: false, message: "Valid claim and invoice IDs are required." });
  try {
    const [rows] = await pool.query(
      `SELECT d.original_filename, d.mime_type, d.storage_name
       FROM user_documents d
       JOIN billing_invoices i ON i.invoice_id = d.invoice_id
       WHERE i.claim_id = ? AND i.invoice_id = ?`,
      [claimId, invoiceId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Claim settlement invoice not found." });
    const file = await readEvidenceFile(rows[0].storage_name);
    res.type(rows[0].mime_type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${rows[0].original_filename.replace(/["\\\r\n]/g, "_")}"`);
    return res.send(file.contents);
  } catch (error) {
    console.error("Failed to download claim settlement invoice:", error.message);
    return res.status(error.code === "ENOENT" ? 404 : 500).json({ success: false, message: "Unable to download claim settlement invoice." });
  }
});

router.patch("/:claimId/review", async (req, res) => {
  const claimId = parsePositiveInteger(req.params.claimId);
  if (!claimId) return res.status(400).json({ success: false, message: "A valid claim ID is required." });
  const validation = validateClaimReviewInput(req.body || {});
  if (validation.message) return res.status(400).json({ success: false, message: validation.message });

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT c.claim_id, c.claim_number, c.user_id, c.claim_status,
              c.policy_id, c.claimed_amount, c.currency_code
       FROM claims c WHERE c.claim_id = ? FOR UPDATE`,
      [claimId]
    );
    if (!rows.length) {
      await rollbackSafely(connection);
      return res.status(404).json({ success: false, message: "Claim not found." });
    }
    const claim = rows[0];
    if (!["submitted", "under_review"].includes(claim.claim_status)) {
      await rollbackSafely(connection);
      return res.status(409).json({ success: false, message: "This claim already has a final demo review decision." });
    }
    const [evidenceCounts] = await connection.query(
      `SELECT COUNT(*) AS total_count,
              SUM(review_status = 'verified') AS verified_count,
              SUM(review_status = 'pending') AS pending_count
       FROM claim_evidence_documents WHERE claim_id = ?`,
      [claimId]
    );
    const evidence = evidenceCounts[0];
    if (Number(evidence.pending_count || 0) > 0) {
      await rollbackSafely(connection);
      return res.status(409).json({ success: false, message: "Review every evidence document before recording a final demo claim decision." });
    }
    if (validation.decision === "approved_demo" && (
      Number(evidence.total_count || 0) === 0 ||
      Number(evidence.verified_count || 0) !== Number(evidence.total_count)
    )) {
      await rollbackSafely(connection);
      return res.status(409).json({ success: false, message: "All claim evidence must be verified before demo approval." });
    }
    await connection.query(
      `UPDATE claims
       SET claim_status = ?, reviewer_user_id = ?, reviewed_at = CURRENT_TIMESTAMP,
           review_notes = ?
       WHERE claim_id = ?`,
      [validation.decision, req.user.userId, validation.notes, claimId]
    );

    let settlementInvoice = null;
    if (validation.decision === "approved_demo") {
      const [policies] = await connection.query(
        `SELECT policy_id, quote_id, policy_number, currency_code
         FROM policies WHERE policy_id = ? FOR UPDATE`,
        [claim.policy_id]
      );
      if (!policies.length) {
        await rollbackSafely(connection);
        return res.status(404).json({ success: false, message: "Policy for claim was not found." });
      }
      const policy = policies[0];
      const invoiceNumber = `TS-CLM-INV-${crypto.randomBytes(7).toString("hex").toUpperCase()}`;
      const invoiceTotals = calculateInvoiceTotals(Number(claim.claimed_amount));
      const [invoiceResult] = await connection.query(
        `INSERT INTO billing_invoices
         (invoice_number, policy_id, quote_id, user_id, premium_amount,
          tax_rate_percent, tax_amount, fee_amount, total_amount, currency_code,
          payment_status, payment_provider, due_at, claim_id, invoice_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', 'demo', CURRENT_DATE, ?, 'claim_settlement')`,
        [
          invoiceNumber,
          policy.policy_id,
          policy.quote_id,
          claim.user_id,
          invoiceTotals.premiumAmount,
          invoiceTotals.taxRatePercent,
          invoiceTotals.taxAmount,
          invoiceTotals.feeAmount,
          invoiceTotals.totalAmount,
          claim.currency_code || policy.currency_code,
          claimId,
        ]
      );
      const invoiceId = invoiceResult.insertId;
      const invoiceData = {
        invoice_number: invoiceNumber,
        policy_number: policy.policy_number,
        plan_name: `Claim ${claim.claim_number}`,
        created_at: new Date().toISOString().slice(0, 10),
        currency_code: claim.currency_code || policy.currency_code,
        payment_status: "PAID",
        premium_amount: invoiceTotals.premiumAmount,
        tax_rate_percent: invoiceTotals.taxRatePercent,
        tax_amount: invoiceTotals.taxAmount,
        fee_amount: invoiceTotals.feeAmount,
        total_amount: invoiceTotals.totalAmount,
      };
      const buffer = await createInvoicePdf(invoiceData);
      const file = { originalname: `${invoiceNumber}.pdf`, buffer, size: buffer.length };
      const fileValidation = await validateEvidenceFile(file);
      const document = await storeUserDocument(connection, {
        userId: claim.user_id,
        file,
        validation: fileValidation,
        policyId: policy.policy_id,
        claimId,
        invoiceId,
        category: "invoice_receipt",
        documentType: "claim_settlement_invoice",
        uploadedByUser: false,
      });
      settlementInvoice = { invoice_id: invoiceId, invoice_number: invoiceNumber, document_id: document.documentId };
      await createUserNotification(connection, {
        userId: claim.user_id,
        type: "invoice_created",
        title: "Claim settlement invoice created",
        message: `Invoice ${invoiceNumber} was generated for approved claim ${claim.claim_number}.`,
        relatedType: "invoice",
        relatedId: invoiceId,
      });
    }

    await createUserNotification(connection, {
      userId: claim.user_id,
      type: "claim_reviewed",
      title: "Claim demo review updated",
      message: `Claim ${claim.claim_number} received a ${validation.decision === "approved_demo" ? "demo approval" : "demo decline"}${settlementInvoice ? ` and settlement invoice ${settlementInvoice.invoice_number}` : ""}. Sign in to view the updated status.`,
      relatedType: "claim",
      relatedId: claimId,
    });
    await connection.commit();
    return res.json({
      success: true,
      message: "Demo review decision recorded. This is not a real insurance decision or payment.",
      data: {
        claim_id: claimId,
        claim_status: validation.decision,
        review_notes: validation.notes,
        settlement_invoice: settlementInvoice,
      },
      educational_simulation: true,
    });
  } catch (error) {
    if (connection) await rollbackSafely(connection);
    console.error("Failed to save demo claim review:", error.message);
    return res.status(500).json({ success: false, message: "Unable to record the demo review." });
  } finally {
    if (connection) connection.release();
  }
});

export default router;