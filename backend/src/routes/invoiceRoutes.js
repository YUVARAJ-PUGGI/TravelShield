import crypto from "node:crypto";
import { Router } from "express";
import pool from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { calculateInvoiceTotals } from "../utils/billing.js";
import { createInvoicePdf } from "../utils/documentPdf.js";
import { createUserNotification, storeUserDocument } from "../utils/documentRecords.js";
import { readEvidenceFile, validateEvidenceFile } from "../utils/evidenceStorage.js";
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

function isValidDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function rollbackSafely(connection) {
  try {
    await connection.rollback();
  } catch (error) {
    console.error("Failed to roll back manual invoice transaction:", error.message);
  }
}

router.get("/", async (req, res) => {
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
    console.error("Failed to load invoices:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load invoices." });
  }
});

router.post("/", async (req, res) => {
  const policyId = parsePositiveInteger(req.body?.policy_id);
  const claimId = req.body?.claim_id == null || req.body?.claim_id === "" ? null : parsePositiveInteger(req.body?.claim_id);
  const customerName = typeof req.body?.customer_name === "string" ? req.body.customer_name.trim() : "";
  const customerEmail = typeof req.body?.customer_email === "string" ? req.body.customer_email.trim() : "";
  const invoiceDate = typeof req.body?.invoice_date === "string" ? req.body.invoice_date.trim() : "";
  const dueDate = typeof req.body?.due_date === "string" ? req.body.due_date.trim() : "";
  const lineItems = Array.isArray(req.body?.line_items) ? req.body.line_items : [];
  const taxRate = parseNonNegativeNumber(req.body?.tax_rate_percent);
  const fees = parseNonNegativeNumber(req.body?.fees ?? req.body?.fee_amount);
  const paymentStatusInput = typeof req.body?.payment_status === "string" ? req.body.payment_status.trim().toLowerCase() : "due";

  if (!policyId) return res.status(400).json({ success: false, message: "A valid policy is required." });
  if (customerName.length < 2 || customerName.length > 150) return res.status(400).json({ success: false, message: "Customer name must be between 2 and 150 characters." });
  if (!customerEmail.includes("@") || !customerEmail.includes(".")) return res.status(400).json({ success: false, message: "A valid customer email is required." });
  if (!isValidDateOnly(invoiceDate)) return res.status(400).json({ success: false, message: "A valid invoice date is required." });
  if (!isValidDateOnly(dueDate)) return res.status(400).json({ success: false, message: "A valid due date is required." });
  if (dueDate < invoiceDate) return res.status(400).json({ success: false, message: "Due date cannot be before the invoice date." });
  if (lineItems.length === 0 || lineItems.length > 50) return res.status(400).json({ success: false, message: "At least one and at most 50 line items are required." });
  for (const item of lineItems) {
    const description = typeof item?.description === "string" ? item.description.trim() : "";
    const qty = Number(item?.qty);
    const unitPrice = Number(item?.unit_price ?? item?.unitPrice);
    if (description.length < 1 || description.length > 255) return res.status(400).json({ success: false, message: "Each line item needs a description between 1 and 255 characters." });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ success: false, message: "Each line item quantity must be greater than zero." });
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return res.status(400).json({ success: false, message: "Each line item unit price must be non-negative." });
  }
  if (taxRate === null || taxRate > 100) return res.status(400).json({ success: false, message: "Tax rate must be between 0 and 100." });
  if (fees === null) return res.status(400).json({ success: false, message: "Fees must be a non-negative number." });
  if (!["paid", "due", "refunded"].includes(paymentStatusInput)) return res.status(400).json({ success: false, message: "Payment status must be Paid, Due, or Refunded." });
  if (claimId === null && req.body?.claim_id != null && req.body?.claim_id !== "") return res.status(400).json({ success: false, message: "A valid claim ID is required." });

  const paymentStatus = paymentStatusInput === "paid" ? "PAID" : paymentStatusInput === "refunded" ? "REFUNDED" : "PENDING";

  let connection;
  const generatedFiles = [];
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const admin = await isCurrentUserAdmin(req.user.userId);
    const [policies] = await connection.query(
      `SELECT p.policy_id, p.policy_number, p.user_id, p.quote_id, p.currency_code, pl.plan_name FROM policies p JOIN quotes q ON q.quote_id = p.quote_id JOIN plans pl ON pl.plan_id = q.plan_id WHERE p.policy_id = ? ${admin ? "" : "AND p.user_id = ?"}`,
      admin ? [policyId] : [policyId, req.user.userId]
    );
    if (!policies.length) { await rollbackSafely(connection); return res.status(404).json({ success: false, message: "The selected policy was not found for your account." }); }
    const policy = policies[0];

    if (claimId) {
      const [claims] = await connection.query(
        `SELECT claim_id, policy_id, user_id FROM claims WHERE claim_id = ? ${admin ? "" : "AND user_id = ?"}`,
        admin ? [claimId] : [claimId, req.user.userId]
      );
      if (!claims.length || Number(claims[0].policy_id) !== Number(policy.policy_id)) { await rollbackSafely(connection); return res.status(400).json({ success: false, message: "The selected claim does not belong to the selected policy." }); }
    }
    const subtotal = Math.round(lineItems.reduce((sum, item) => sum + Number(item.qty) * Number(item.unit_price ?? item.unitPrice), 0) * 100) / 100;
    const invoiceTotals = calculateInvoiceTotals(subtotal, taxRate, fees);
    const invoiceNumber = createInvoiceNumber();

    const [invoiceResult] = await connection.query(
      `INSERT INTO billing_invoices (invoice_number, policy_id, quote_id, claim_id, user_id, invoice_type, premium_amount, tax_rate_percent, tax_amount, fee_amount, total_amount, currency_code, payment_status, payment_provider, due_at, created_at) VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, 'demo', ?, ?)`,
      [invoiceNumber, policy.policy_id, policy.quote_id, claimId, req.user.userId, invoiceTotals.premiumAmount, invoiceTotals.taxRatePercent, invoiceTotals.taxAmount, invoiceTotals.feeAmount, invoiceTotals.totalAmount, policy.currency_code, paymentStatus, dueDate, invoiceDate]
    );
    const invoiceId = invoiceResult.insertId;

    const invoiceDocumentFile = {
      originalname: `${invoiceNumber}.pdf`,
      buffer: await createInvoicePdf({
        invoice_number: invoiceNumber,
        policy_number: policy.policy_number,
        plan_name: policy.plan_name,
        created_at: invoiceDate,
        currency_code: policy.currency_code,
        payment_status: paymentStatus,
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
      policyId: policy.policy_id,
      claimId,
      invoiceId,
      category: "invoice_receipt",
      documentType: "invoice",
    });
    generatedFiles.push(invoiceDocument);

    await createUserNotification(connection, {
      userId: req.user.userId,
      type: "invoice_created",
      title: "Invoice ready",
      message: `Invoice ${invoiceNumber} is ready.`,
      relatedType: "invoice",
      relatedId: invoiceId,
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Manual invoice created.",
      data: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        policy_id: policy.policy_id,
        policy_number: policy.policy_number,
        claim_id: claimId,
        customer_name: customerName,
        customer_email: customerEmail,
        invoice_date: invoiceDate,
        due_date: dueDate,
        line_items: lineItems,
        ...invoiceTotals,
        currency_code: policy.currency_code,
        payment_status: paymentStatus,
        payment_provider: "demo",
      },
      educational_simulation: true,
      disclaimer: "Demo invoice only. This does not charge money or create real insurance coverage.",
    });
  } catch (error) {
    if (connection) await rollbackSafely(connection);
    for (const file of generatedFiles) await unlink(file.storagePath).catch(() => {});
    console.error("Failed to create manual invoice:", error.message);
    return res.status(500).json({ success: false, message: "Unable to create a manual invoice." });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/:invoiceId/pdf", async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);
  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    return res.status(400).json({ success: false, message: "A valid invoice ID is required." });
  }
  try {
    const admin = await isCurrentUserAdmin(req.user.userId);
    const ownerClause = admin ? "" : "AND i.user_id = ?";
    const parameters = admin ? [invoiceId] : [invoiceId, req.user.userId];
    const [rows] = await pool.query(
      `SELECT d.original_filename, d.mime_type, d.storage_name FROM user_documents d JOIN billing_invoices i ON i.invoice_id = d.invoice_id AND i.user_id = d.user_id WHERE i.invoice_id = ? ${ownerClause} AND d.document_type IN ('invoice', 'claim_settlement_invoice')`,
      parameters
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Invoice file not found." });
    const file = await readEvidenceFile(rows[0].storage_name);
    res.type(rows[0].mime_type || "application/pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${rows[0].original_filename.replace(/["\\\r\n]/g, "_")}"`);
    return res.send(file.contents);
  } catch (error) {
    console.error("Failed to download invoice PDF:", error.message);
    return res.status(error.code === "ENOENT" ? 404 : 500).json({ success: false, message: "Unable to download invoice." });
  }
});

export default router;
