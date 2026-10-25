import crypto from "node:crypto";
import { unlink } from "node:fs/promises";
import { Router } from "express";
import multer from "multer";
import pool from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  maximumEvidenceSize,
  readEvidenceFile,
  saveEvidenceFile,
  validateEvidenceFile,
} from "../utils/evidenceStorage.js";
import {
  parsePositiveInteger,
  validateClaimInput,
  validatePolicyEligibility,
} from "../utils/claimValidation.js";

const router = Router();
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maximumEvidenceSize, files: 1, fields: 2, parts: 3 },
});

router.use(requireAuth);

function createClaimNumber() {
  return `TS-CLM-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

async function rollbackSafely(connection) {
  try {
    await connection.rollback();
  } catch (rollbackError) {
    console.error("Failed to roll back simulated claim transaction:", rollbackError.message);
  }
}

const claimSelect = `
  SELECT c.claim_id, c.claim_number, c.claim_status,
         DATE_FORMAT(c.incident_date, '%Y-%m-%d') AS incident_date,
         c.description, c.claimed_amount, c.currency_code, c.submitted_at,
         c.created_at, c.updated_at, c.policy_id,
         p.policy_number,
         DATE_FORMAT(p.coverage_start_date, '%Y-%m-%d') AS coverage_start_date,
         DATE_FORMAT(p.coverage_end_date, '%Y-%m-%d') AS coverage_end_date,
         pl.plan_name
  FROM claims c
  JOIN policies p ON p.policy_id = c.policy_id
  JOIN quotes q ON q.quote_id = p.quote_id
  JOIN plans pl ON pl.plan_id = q.plan_id`;

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${claimSelect}
       WHERE c.user_id = ? ORDER BY c.created_at DESC`,
      [req.user.userId]
    );
    return res.json({
      success: true,
      count: rows.length,
      data: rows,
      educational_simulation: true,
    });
  } catch (error) {
    console.error("Failed to fetch user claims:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch your simulated claims.",
    });
  }
});

router.get("/:claimId", async (req, res) => {
  const claimId = parsePositiveInteger(req.params.claimId);
  if (!claimId) {
    return res.status(400).json({
      success: false,
      message: "A valid claim ID is required.",
    });
  }

  try {
    const [rows] = await pool.query(
      `${claimSelect} WHERE c.claim_id = ? AND c.user_id = ?`,
      [claimId, req.user.userId]
    );
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Simulated claim not found.",
      });
    }
    return res.json({
      success: true,
      data: rows[0],
      educational_simulation: true,
      disclaimer:
        "Educational simulation only — not a real insurance claim or reimbursement decision.",
    });
  } catch (error) {
    console.error("Failed to fetch simulated claim:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch the simulated claim.",
    });
  }
});

async function findOwnedClaim(claimId, userId) {
  const [rows] = await pool.query(
    "SELECT claim_id FROM claims WHERE claim_id = ? AND user_id = ?",
    [claimId, userId]
  );
  return rows[0] || null;
}

router.get("/:claimId/evidence", async (req, res) => {
  const claimId = parsePositiveInteger(req.params.claimId);
  if (!claimId) {
    return res.status(400).json({ success: false, message: "A valid claim ID is required." });
  }

  try {
    if (!(await findOwnedClaim(claimId, req.user.userId))) {
      return res.status(404).json({ success: false, message: "Simulated claim not found." });
    }
    const [rows] = await pool.query(
      `SELECT document_id, original_filename, mime_type, file_size, created_at
       FROM claim_evidence_documents
       WHERE claim_id = ? ORDER BY created_at DESC, document_id DESC`,
      [claimId]
    );
    return res.json({ success: true, data: rows, educational_simulation: true });
  } catch (error) {
    console.error("Failed to list claim evidence:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load evidence documents for the simulated claim.",
    });
  }
});

router.post(
  "/:claimId/evidence",
  (req, res, next) => {
    evidenceUpload.single("evidence")(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? "Evidence documents must be 10 MB or smaller."
            : "The evidence upload is invalid.";
        return res.status(400).json({ success: false, message });
      }
      if (error) {
        console.error("Evidence upload parsing failed:", error.message);
        return res.status(400).json({ success: false, message: "The evidence upload is invalid." });
      }
      return next();
    });
  },
  async (req, res) => {
    const claimId = parsePositiveInteger(req.params.claimId);
    if (!claimId) {
      return res.status(400).json({ success: false, message: "A valid claim ID is required." });
    }

    let savedFile;
    try {
      if (!(await findOwnedClaim(claimId, req.user.userId))) {
        return res.status(404).json({ success: false, message: "Simulated claim not found." });
      }
      const validation = await validateEvidenceFile(req.file);
      if (validation.message) {
        return res.status(400).json({ success: false, message: validation.message });
      }
      savedFile = await saveEvidenceFile(req.file, validation.extension);
      const [result] = await pool.query(
        `INSERT INTO claim_evidence_documents
         (claim_id, original_filename, storage_name, mime_type, file_size)
         VALUES (?, ?, ?, ?, ?)`,
        [
          claimId,
          validation.originalFilename,
          savedFile.storageName,
          validation.mimeType,
          req.file.size,
        ]
      );
      return res.status(201).json({
        success: true,
        message: "Evidence document uploaded.",
        data: {
          document_id: result.insertId,
          original_filename: validation.originalFilename,
          mime_type: validation.mimeType,
          file_size: req.file.size,
        },
        educational_simulation: true,
      });
    } catch (error) {
      if (savedFile) {
        try {
          await unlink(savedFile.storagePath);
        } catch (cleanupError) {
          console.error("Failed to clean up evidence file:", cleanupError.message);
        }
      }
      if (error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(404).json({ success: false, message: "Simulated claim not found." });
      }
      console.error("Failed to upload claim evidence:", error.message);
      return res.status(500).json({
        success: false,
        message: "Unable to upload evidence for the simulated claim.",
      });
    }
  }
);

router.get("/:claimId/evidence/:documentId/download", async (req, res) => {
  const claimId = parsePositiveInteger(req.params.claimId);
  const documentId = parsePositiveInteger(req.params.documentId);
  if (!claimId || !documentId) {
    return res.status(400).json({ success: false, message: "Valid claim and document IDs are required." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT d.original_filename, d.mime_type, d.storage_name
       FROM claim_evidence_documents d
       JOIN claims c ON c.claim_id = d.claim_id
       WHERE d.document_id = ? AND d.claim_id = ? AND c.user_id = ?`,
      [documentId, claimId, req.user.userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Evidence document not found." });
    }
    const document = rows[0];
    const file = await readEvidenceFile(document.storage_name);
    res.type(document.mime_type);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.original_filename.replace(/["\\\r\n]/g, "_")}"`
    );
    return res.send(file.contents);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ success: false, message: "Evidence document file is unavailable." });
    }
    console.error("Failed to download claim evidence:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to download the evidence document.",
    });
  }
});

router.post("/", async (req, res) => {
  const validation = validateClaimInput(req.body || {});
  if (validation.message) {
    return res.status(400).json({
      success: false,
      message: validation.message,
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [policies] = await connection.query(
      `SELECT policy_id, user_id, policy_number, policy_status,
              coverage_start_date, coverage_end_date, currency_code
       FROM policies
       WHERE policy_id = ? AND user_id = ?
       FOR UPDATE`,
      [validation.policyId, req.user.userId]
    );
    if (!policies.length) {
      await rollbackSafely(connection);
      return res.status(404).json({
        success: false,
        message: "The simulated policy was not found for the signed-in user.",
      });
    }

    const policy = policies[0];
    const policyEligibilityMessage = validatePolicyEligibility(
      policy,
      validation.incidentDate
    );
    if (policyEligibilityMessage) {
      await rollbackSafely(connection);
      return res.status(409).json({
        success: false,
        message: policyEligibilityMessage,
      });
    }

    const claimNumber = createClaimNumber();
    const [result] = await connection.query(
      `INSERT INTO claims
       (claim_number, user_id, policy_id, claim_status, incident_date,
        description, claimed_amount, currency_code)
       VALUES (?, ?, ?, 'submitted', ?, ?, ?, ?)`,
      [
        claimNumber,
        req.user.userId,
        validation.policyId,
        validation.incidentDate,
        validation.description,
        validation.claimedAmount,
        policy.currency_code,
      ]
    );
    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Educational claim simulation submitted.",
      data: {
        claim_id: result.insertId,
        claim_number: claimNumber,
        policy_id: policy.policy_id,
        policy_number: policy.policy_number,
        claim_status: "submitted",
        incident_date: validation.incidentDate,
        description: validation.description,
        claimed_amount: validation.claimedAmount,
        currency_code: policy.currency_code,
      },
      educational_simulation: true,
      disclaimer:
        "Educational simulation only — the claimed amount is illustrative and is not checked here against benefit sub-limits, deductibles, accumulated claims, or necessarily the policy's overall coverage limit. This is not a real insurance claim or reimbursement decision.",
    });
  } catch (error) {
    if (connection) await rollbackSafely(connection);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Unable to create a unique simulated claim number. Please try again.",
      });
    }
    console.error("Failed to submit simulated claim:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to submit the simulated claim.",
    });
  } finally {
    if (connection) connection.release();
  }
});

export default router;
