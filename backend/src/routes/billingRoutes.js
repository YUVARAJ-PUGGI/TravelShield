import crypto from "node:crypto";
import { Router } from "express";
import pool from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateEligibleQuote } from "../utils/policyValidation.js";
import { getInclusiveCalendarDays } from "../utils/dateOnly.js";
import { calculatePremium } from "../utils/quoteCalculator.js";
import { calculateInvoiceTotals } from "../utils/billing.js";
import { readEvidenceFile, validateEvidenceFile } from "../utils/evidenceStorage.js";
import { createInvoicePdf, createInsuranceCardPdf, createPolicyCertificatePdf } from "../utils/documentPdf.js";
import { createUserNotification, storeUserDocument } from "../utils/documentRecords.js";
import { unlink } from "node:fs/promises";

const router = Router();
router.use(requireAuth);

async function isCurrentUserAdmin(userId) {
  try {
    const [rows] = await pool.query("SELECT is_admin FROM users WHERE user_id = ?", [userId]);
    return Boolean(rows[0]?.is_admin);
  } catch (error) {
    console.error("Failed to check admin access:", error.message);
    return false;
  }
}


function createPolicyNumber() {
  return `TS-DEMO-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

function createInvoiceNumber() {
  return `TS-INV-${crypto.randomBytes(7).toString("hex").toUpperCase()}`;
}

function getTodayDateOnly() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

async function rollbackSafely(connection) {
  try {
    await connection.rollback();
  } catch (error) {
    console.error("Failed to roll back billing transaction:", error.message);
  }
}

router.get("/invoices", async (req, res) => {
  try {
    const admin = await isCurrentUserAdmin(req.user.userId);
    const whereClause = admin ? "" : "WHERE i.user_id = ?";
    const parameters = admin ? [] : [req.user.userId];
    const [rows] = await pool.query(
      `SELECT i.invoice_id, i.invoice_number, i.policy_id, i.quote_id, i.claim_id,
               i.invoice_type, i.premium_amount, i.tax_rate_percent, i.tax_amount,
              i.fee_amount, i.total_amount, i.currency_code,
              i.payment_status, i.payment_provider, i.payment_reference,
              i.paid_at, i.created_at,
              DATE_FORMAT(i.due_at, '%Y-%m-%d') AS due_date,
              CASE
                WHEN i.payment_status = 'PAID' THEN 'Paid'
                WHEN i.payment_status = 'REFUNDED' THEN 'Refunded'
                WHEN i.payment_status = 'PENDING' AND i.due_at < CURRENT_DATE THEN 'Overdue'
                WHEN i.payment_status = 'PENDING' THEN 'Due'
                ELSE 'Failed'
              END AS invoice_status,
              p.policy_number, p.policy_status,
              pl.plan_name, c.country_name,
              cl.claim_number
       FROM billing_invoices i
       JOIN policies p ON p.policy_id = i.policy_id
       JOIN quotes q ON q.quote_id = i.quote_id
       JOIN plans pl ON pl.plan_id = q.plan_id
       JOIN countries c ON c.country_id = q.destination_country_id
       LEFT JOIN claims cl ON cl.claim_id = i.claim_id
       ${whereClause}
       ORDER BY i.created_at DESC, i.invoice_id DESC`,
      parameters
    );
    return res.json({ success: true, count: rows.length, data: rows, educational_simulation: true });
  } catch (error) {
    console.error("Failed to load billing history:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load billing history." });
  }
});

router.post("/invoices", async (req, res) => {
  const quoteId = Number(req.body?.quote_id);
  if (!Number.isInteger(quoteId) || quoteId < 1) {
    return res.status(400).json({ success: false, message: "A valid quote ID is required." });
  }

  let connection;
  const generatedFiles = [];
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [quotes] = await connection.query(
      `SELECT q.quote_id, q.user_id, q.destination_country_id, q.plan_id,
              DATE_FORMAT(q.start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(q.end_date, '%Y-%m-%d') AS end_date,
              q.traveller_count, q.premium_amount, q.currency_code,
              q.quote_status, p.base_daily_rate, p.plan_name
       FROM quotes q
       JOIN plans p ON p.plan_id = q.plan_id
       WHERE q.quote_id = ? AND q.user_id = ? AND p.is_active = 1
       FOR UPDATE`,
      [quoteId, req.user.userId]
    );
    if (!quotes.length) {
      await rollbackSafely(connection);
      return res.status(404).json({ success: false, message: "The quote was not found for your account." });
    }

    const quote = quotes[0];
    const quoteError = validateEligibleQuote(quote);
    if (quoteError) {
      await rollbackSafely(connection);
      return res.status(409).json({ success: false, message: quoteError });
    }

    const durationDays = getInclusiveCalendarDays(quote.start_date, quote.end_date);
    const premiumAmount = calculatePremium(Number(quote.base_daily_rate), durationDays, quote.traveller_count);
    const invoiceTotals = calculateInvoiceTotals(premiumAmount);
    const policyNumber = createPolicyNumber();
    const invoiceNumber = createInvoiceNumber();
    const issueDate = getTodayDateOnly();

    const [policyResult] = await connection.query(
      `INSERT INTO policies
       (policy_number, user_id, quote_id, policy_status, issue_date,
        coverage_start_date, coverage_end_date, premium_amount, currency_code)
       VALUES (?, ?, ?, 'simulated_pending_payment', ?, ?, ?, ?, ?)`,
      [policyNumber, req.user.userId, quote.quote_id, issueDate, quote.start_date, quote.end_date, invoiceTotals.premiumAmount, quote.currency_code]
    );
    const [invoiceResult] = await connection.query(
      `INSERT INTO billing_invoices
       (invoice_number, policy_id, quote_id, user_id, premium_amount,
        tax_rate_percent, tax_amount, fee_amount, total_amount, currency_code,
        payment_status, payment_provider, due_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'demo', DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY))`,
      [
        invoiceNumber,
        policyResult.insertId,
        quote.quote_id,
        req.user.userId,
        invoiceTotals.premiumAmount,
        invoiceTotals.taxRatePercent,
        invoiceTotals.taxAmount,
        invoiceTotals.feeAmount,
        invoiceTotals.totalAmount,
        quote.currency_code,
      ]
    );
    const invoiceDocumentFile = {
      originalname: `${invoiceNumber}.pdf`,
      buffer: await createInvoicePdf({
        invoice_number: invoiceNumber,
        policy_number: policyNumber,
        plan_name: quote.plan_name,
        created_at: issueDate,
        currency_code: quote.currency_code,
        payment_status: "PENDING",
        premium_amount: invoiceTotals.premiumAmount,
        tax_rate_percent: invoiceTotals.taxRatePercent,
        tax_amount: invoiceTotals.taxAmount,
        fee_amount: invoiceTotals.feeAmount,
        total_amount: invoiceTotals.totalAmount,
      }),
    };
    invoiceDocumentFile.size = invoiceDocumentFile.buffer.length;
    const invoiceValidation = await validateEvidenceFile(invoiceDocumentFile);
    const invoiceDocument = await storeUserDocument(connection, {
      userId: req.user.userId,
      file: invoiceDocumentFile,
      validation: invoiceValidation,
      policyId: policyResult.insertId,
      invoiceId: invoiceResult.insertId,
      category: "invoice_receipt",
      documentType: "invoice",
    });
    generatedFiles.push(invoiceDocument);
    await createUserNotification(connection, {
      userId: req.user.userId,
      type: "invoice_created",
      title: "Invoice created",
      message: `Invoice ${invoiceNumber} is ready. Payment status: PENDING.`,
      relatedType: "invoice",
      relatedId: invoiceResult.insertId,
    });
    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Simulated invoice created. No payment has been taken and the policy is not active.",
      data: {
        invoice_id: invoiceResult.insertId,
        invoice_number: invoiceNumber,
        policy_id: policyResult.insertId,
        policy_number: policyNumber,
        policy_status: "simulated_pending_payment",
        quote_id: quote.quote_id,
        plan_name: quote.plan_name,
        duration_days: durationDays,
        traveller_count: quote.traveller_count,
        ...invoiceTotals,
        currency_code: quote.currency_code,
        payment_status: "PENDING",
        payment_provider: "demo",
      },
      educational_simulation: true,
      disclaimer: "Demo invoice only. This does not charge money or create real insurance coverage.",
    });
  } catch (error) {
    if (connection) await rollbackSafely(connection);
    for (const file of generatedFiles) await unlink(file.storagePath).catch(() => {});
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "An invoice or policy already exists for this quote." });
    }
    console.error("Failed to create simulated invoice:", error.message);
    return res.status(500).json({ success: false, message: "Unable to create a billing invoice." });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/invoices/:invoiceId/download", async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);
  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    return res.status(400).json({ success: false, message: "A valid invoice ID is required." });
  }
  try {
    const admin = await isCurrentUserAdmin(req.user.userId);
    const ownerClause = admin ? "" : "AND i.user_id = ?";
    const parameters = admin ? [invoiceId] : [invoiceId, req.user.userId];
    const [rows] = await pool.query(
      `SELECT d.original_filename, d.mime_type, d.storage_name
       FROM user_documents d
       JOIN billing_invoices i ON i.invoice_id = d.invoice_id AND i.user_id = d.user_id
       WHERE i.invoice_id = ? ${ownerClause} AND d.document_type IN ('invoice', 'claim_settlement_invoice')`,
      parameters
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Invoice file not found." });
    const file = await readEvidenceFile(rows[0].storage_name);
    res.type(rows[0].mime_type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${rows[0].original_filename.replace(/["\\\r\n]/g, "_")}"`);
    return res.send(file.contents);
  } catch (error) {
    console.error("Failed to download invoice:", error.message);
    return res.status(error.code === "ENOENT" ? 404 : 500).json({ success: false, message: "Unable to download invoice." });
  }
});

router.post("/invoices/:invoiceId/demo-payment", async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);
  const outcome = typeof req.body?.outcome === "string" ? req.body.outcome.toUpperCase() : "";
  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    return res.status(400).json({ success: false, message: "A valid invoice ID is required." });
  }
  if (!['PAID', 'FAILED'].includes(outcome)) {
    return res.status(400).json({ success: false, message: "Demo payment outcome must be PAID or FAILED." });
  }

  let connection;
  const generatedFiles = [];
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [invoices] = await connection.query(
      `SELECT i.invoice_id, i.invoice_number, i.policy_id, i.payment_status,
          i.payment_provider, i.premium_amount, i.currency_code,
          p.policy_number, DATE_FORMAT(p.coverage_start_date, '%Y-%m-%d') AS coverage_start_date,
          DATE_FORMAT(p.coverage_end_date, '%Y-%m-%d') AS coverage_end_date,
          pl.plan_name, c.country_name, u.full_name
       FROM billing_invoices i
       JOIN policies p ON p.policy_id = i.policy_id
       JOIN quotes q ON q.quote_id = i.quote_id
       JOIN plans pl ON pl.plan_id = q.plan_id
       JOIN countries c ON c.country_id = q.destination_country_id
       JOIN users u ON u.user_id = i.user_id
       WHERE i.invoice_id = ? AND i.user_id = ?
       FOR UPDATE`,
      [invoiceId, req.user.userId]
    );
    if (!invoices.length) {
      await rollbackSafely(connection);
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }
    const invoice = invoices[0];
    if (invoice.payment_provider !== "demo" || !["PENDING", "FAILED"].includes(invoice.payment_status)) {
      await rollbackSafely(connection);
      return res.status(409).json({ success: false, message: "Only pending or failed demo invoices can receive a demo payment confirmation." });
    }

    const reference = `DEMO-PAY-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    await connection.query(
      `UPDATE billing_invoices
       SET payment_status = ?, payment_reference = ?, paid_at = ?
      WHERE invoice_id = ? AND user_id = ? AND payment_status IN ('PENDING', 'FAILED')`,
      [outcome, reference, outcome === "PAID" ? new Date() : null, invoiceId, req.user.userId]
    );
    if (outcome === "PAID") {
      await connection.query(
        `UPDATE policies SET policy_status = 'simulated_issued', issue_date = ?
         WHERE policy_id = ? AND user_id = ? AND policy_status = 'simulated_pending_payment'`,
        [getTodayDateOnly(), invoice.policy_id, req.user.userId]
      );
      const policyData = {
        ...invoice,
        issue_date: getTodayDateOnly(),
      };
      const generatedPolicyDocuments = [
        ["policy_certificate", `${invoice.policy_number}-certificate.pdf`, await createPolicyCertificatePdf(policyData)],
        ["insurance_card", `${invoice.policy_number}-insurance-card.pdf`, await createInsuranceCardPdf(policyData)],
      ];
      for (const [documentType, filename, buffer] of generatedPolicyDocuments) {
        const file = { originalname: filename, buffer, size: buffer.length };
        const validation = await validateEvidenceFile(file);
        const document = await storeUserDocument(connection, {
          userId: req.user.userId,
          file,
          validation,
          policyId: invoice.policy_id,
          invoiceId,
          category: "policy",
          documentType,
        });
        generatedFiles.push(document);
        await createUserNotification(connection, {
          userId: req.user.userId,
          type: "document_added",
          title: documentType === "policy_certificate" ? "Policy certificate added" : "Insurance card added",
          message: `${documentType === "policy_certificate" ? "Your certificate" : "Your insurance card"} is available in Documents.`,
          relatedType: "document",
          relatedId: document.documentId,
        });
      }
      await createUserNotification(connection, {
        userId: req.user.userId,
        type: "policy_activated",
        title: "Simulated policy activated",
        message: `Policy ${invoice.policy_number} is active in this demo. No real coverage was created.`,
        relatedType: "policy",
        relatedId: invoice.policy_id,
      });
    }
    await createUserNotification(connection, {
      userId: req.user.userId,
      type: "payment_updated",
      title: outcome === "PAID" ? "Demo payment recorded" : "Demo payment failed",
      message: `Invoice ${invoice.invoice_number}: ${outcome}. No real payment was processed.`,
      relatedType: "invoice",
      relatedId: invoiceId,
    });
    await connection.commit();
    return res.json({
      success: true,
      message: outcome === "PAID"
        ? "Demo payment marked paid and the simulated policy activated. No real payment was processed."
        : "Demo payment marked failed. The simulated policy remains inactive.",
      data: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        payment_status: outcome,
        payment_reference: reference,
        policy_status: outcome === "PAID" ? "simulated_issued" : "simulated_pending_payment",
        payment_provider: "demo",
      },
      educational_simulation: true,
    });
  } catch (error) {
    if (connection) await rollbackSafely(connection);
    for (const file of generatedFiles) await unlink(file.storagePath).catch(() => {});
    console.error("Failed to confirm simulated payment:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update simulated payment status." });
  } finally {
    if (connection) connection.release();
  }
});

export default router;