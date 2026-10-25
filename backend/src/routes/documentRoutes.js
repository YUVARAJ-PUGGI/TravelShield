import { unlink } from "node:fs/promises";
import { Router } from "express";
import multer from "multer";
import pool from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { maximumEvidenceSize, readEvidenceFile, validateEvidenceFile } from "../utils/evidenceStorage.js";
import { createUserNotification, storeUserDocument } from "../utils/documentRecords.js";
import { parsePositiveInteger } from "../utils/claimValidation.js";

const router = Router();
router.use(requireAuth);

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maximumEvidenceSize, files: 1, fields: 4, parts: 5 },
});

function toDocument(row, source) {
  return {
    ...row,
    source,
    document_id: Number(row.document_id),
    file_size: Number(row.file_size),
  };
}

router.get("/", async (req, res) => {
  try {
    const [storedRows] = await pool.query(
      `SELECT d.document_id, d.original_filename, d.mime_type, d.file_size,
              d.document_category, d.document_type, d.document_status,
              d.uploaded_by_user, d.policy_id, d.claim_id, d.invoice_id,
              d.created_at, p.policy_number, c.claim_number, i.invoice_number
       FROM user_documents d
       LEFT JOIN policies p ON p.policy_id = d.policy_id
       LEFT JOIN claims c ON c.claim_id = d.claim_id
       LEFT JOIN billing_invoices i ON i.invoice_id = d.invoice_id
       WHERE d.user_id = ?`,
      [req.user.userId]
    );
    const [claimRows] = await pool.query(
      `SELECT d.document_id, d.original_filename, d.mime_type, d.file_size,
              'claim' AS document_category,
              COALESCE(d.evidence_label, d.evidence_kind) AS document_type,
              'available' AS document_status, 0 AS uploaded_by_user,
              NULL AS invoice_id, d.created_at, d.claim_id, c.claim_number,
              c.policy_id, p.policy_number, NULL AS invoice_number
       FROM claim_evidence_documents d
       JOIN claims c ON c.claim_id = d.claim_id AND c.user_id = ?
       JOIN policies p ON p.policy_id = c.policy_id
       WHERE c.user_id = ?`,
      [req.user.userId, req.user.userId]
    );
    const requestedCategory = typeof req.query.category === "string" ? req.query.category : "all";
    const rows = [
      ...storedRows.map((row) => toDocument(row, "stored")),
      ...claimRows.map((row) => toDocument(row, "claim")),
    ].filter((row) => requestedCategory === "all" || row.document_category === requestedCategory)
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
    return res.json({ success: true, count: rows.length, data: rows, educational_simulation: true });
  } catch (error) {
    console.error("Failed to list user documents:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load your documents." });
  }
});

router.post(
  "/",
  (req, res, next) => {
    documentUpload.single("document")(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
          ? "Documents must be 10 MB or smaller."
          : "The document upload is invalid.";
        return res.status(400).json({ success: false, message });
      }
      if (error) return res.status(400).json({ success: false, message: "The document upload is invalid." });
      return next();
    });
  },
  async (req, res) => {
    const policyId = req.body?.policy_id ? parsePositiveInteger(req.body.policy_id) : null;
    const claimId = req.body?.claim_id ? parsePositiveInteger(req.body.claim_id) : null;
    const documentType = typeof req.body?.document_type === "string" ? req.body.document_type.trim() : "";
    if ((req.body?.policy_id && !policyId) || (req.body?.claim_id && !claimId) || (policyId && claimId)) {
      return res.status(400).json({ success: false, message: "Choose one valid policy or claim to link this document." });
    }
    if (!/^[\w -]{2,60}$/.test(documentType)) {
      return res.status(400).json({ success: false, message: "Document type must be 2 to 60 letters, numbers, spaces, underscores, or hyphens." });
    }

    let connection;
    let savedFile;
    try {
      const validation = await validateEvidenceFile(req.file);
      if (validation.message) return res.status(400).json({ success: false, message: validation.message });

      connection = await pool.getConnection();
      await connection.beginTransaction();
      if (policyId) {
        const [rows] = await connection.query(
          "SELECT policy_id FROM policies WHERE policy_id = ? AND user_id = ?",
          [policyId, req.user.userId]
        );
        if (!rows.length) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: "Policy not found for your account." });
        }
      }
      if (claimId) {
        const [rows] = await connection.query(
          "SELECT claim_id FROM claims WHERE claim_id = ? AND user_id = ?",
          [claimId, req.user.userId]
        );
        if (!rows.length) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: "Claim not found for your account." });
        }
      }

      const document = await storeUserDocument(connection, {
        userId: req.user.userId,
        file: req.file,
        validation,
        policyId,
        claimId,
        category: claimId ? "claim" : policyId ? "policy" : "uploaded",
        documentType,
        uploadedByUser: true,
      });
      savedFile = document;
      await createUserNotification(connection, {
        userId: req.user.userId,
        type: "document_added",
        title: "Document uploaded",
        message: `${validation.originalFilename} was added to your Documents.`,
        relatedType: "document",
        relatedId: document.documentId,
      });
      await connection.commit();
      return res.status(201).json({
        success: true,
        message: "Document uploaded to your private Documents area.",
        data: {
          document_id: document.documentId,
          original_filename: validation.originalFilename,
          mime_type: validation.mimeType,
          file_size: req.file.size,
          document_category: claimId ? "claim" : policyId ? "policy" : "uploaded",
          document_type: documentType,
        },
      });
    } catch (error) {
      if (connection) {
        try { await connection.rollback() } catch {}
      }
      if (savedFile) await unlink(savedFile.storagePath).catch(() => {});
      console.error("Failed to upload user document:", error.message);
      return res.status(500).json({ success: false, message: "Unable to save the document." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get("/:source/:documentId/download", async (req, res) => {
  const documentId = parsePositiveInteger(req.params.documentId);
  if (!documentId || !["stored", "claim"].includes(req.params.source)) {
    return res.status(400).json({ success: false, message: "Valid document details are required." });
  }

  try {
    const query = req.params.source === "stored"
      ? `SELECT original_filename, mime_type, storage_name FROM user_documents
         WHERE document_id = ? AND user_id = ?`
      : `SELECT d.original_filename, d.mime_type, d.storage_name
         FROM claim_evidence_documents d JOIN claims c ON c.claim_id = d.claim_id
         WHERE d.document_id = ? AND c.user_id = ?`;
    const [rows] = await pool.query(query, [documentId, req.user.userId]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Document not found." });
    const file = await readEvidenceFile(rows[0].storage_name);
    res.type(rows[0].mime_type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${rows[0].original_filename.replace(/["\\\r\n]/g, "_")}"`);
    return res.send(file.contents);
  } catch (error) {
    console.error("Failed to download user document:", error.message);
    return res.status(error.code === "ENOENT" ? 404 : 500).json({ success: false, message: "Unable to download the document." });
  }
});

router.delete("/:documentId", async (req, res) => {
  const documentId = parsePositiveInteger(req.params.documentId);
  if (!documentId) return res.status(400).json({ success: false, message: "A valid document ID is required." });
  try {
    const [rows] = await pool.query(
      `SELECT storage_name FROM user_documents
       WHERE document_id = ? AND user_id = ? AND uploaded_by_user = 1`,
      [documentId, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "User-uploaded document not found." });
    const file = await readEvidenceFile(rows[0].storage_name);
    await unlink(file.storagePath);
    const [result] = await pool.query(
      `DELETE FROM user_documents
       WHERE document_id = ? AND user_id = ? AND uploaded_by_user = 1`,
      [documentId, req.user.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "User-uploaded document not found." });
    return res.json({ success: true, message: "Uploaded document deleted." });
  } catch (error) {
    console.error("Failed to delete user document:", error.message);
    return res.status(500).json({ success: false, message: "Unable to delete the uploaded document." });
  }
});

export default router;