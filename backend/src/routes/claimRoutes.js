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
} from "../utils/claimValidation.js";
import { evaluateClaimEligibility } from "../utils/claimEligibility.js";
import { readFlightVerificationToken } from "../utils/flightVerification.js";
import { createUserNotification } from "../utils/documentRecords.js";
import { matchesBenefitForDisruption } from "../utils/claimCategory.js";

const router = Router();
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maximumEvidenceSize, files: 10, fields: 20, parts: 32 },
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
         c.created_at, c.updated_at, c.policy_id, c.benefit_id,
         c.flight_number, DATE_FORMAT(c.flight_date, '%Y-%m-%d') AS flight_date,
         c.flight_verification_status, pb.benefit_name,
         p.policy_number,
         DATE_FORMAT(p.coverage_start_date, '%Y-%m-%d') AS coverage_start_date,
         DATE_FORMAT(p.coverage_end_date, '%Y-%m-%d') AS coverage_end_date,
         pl.plan_name
  FROM claims c
  JOIN policies p ON p.policy_id = c.policy_id
  JOIN quotes q ON q.quote_id = p.quote_id
  JOIN plans pl ON pl.plan_id = q.plan_id
  LEFT JOIN plan_benefits pb ON pb.benefit_id = c.benefit_id`;

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
            `SELECT document_id, original_filename, mime_type, file_size,
              evidence_kind, evidence_label, created_at
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
      await pool.query(
        `INSERT INTO user_notifications
         (user_id, notification_type, title, message, related_type, related_id)
         VALUES (?, 'document_added', 'Claim evidence added', ?, 'claim', ?)`,
        [req.user.userId, `${validation.originalFilename} was added to claim evidence.`, claimId]
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

  async function getEligibilityContext(input, userId, hasTicket, supportingDocumentCount) {
    const validation = validateClaimInput(input);
    if (validation.message) return { statusCode: 400, message: validation.message };

    const benefitId = parsePositiveInteger(input.benefit_id);
    if (!benefitId) return { statusCode: 400, message: "Select a valid plan benefit." };

    const flightNumber = typeof input.flight_number === "string"
      ? input.flight_number.trim().toUpperCase()
      : "";
    const flightDate = input.flight_date;
    const verification = readFlightVerificationToken(
      input.flight_verification_token,
      { flightNumber, flightDate }
    );
    if (!verification) {
      return { statusCode: 400, message: "Verify the flight number and date again before continuing." };
    }

    const [policies] = await pool.query(
            `SELECT p.policy_id, p.policy_number, p.policy_status,
              DATE_FORMAT(p.coverage_start_date, '%Y-%m-%d') AS coverage_start_date,
              DATE_FORMAT(p.coverage_end_date, '%Y-%m-%d') AS coverage_end_date,
              p.currency_code,
              q.plan_id, pl.coverage_amount, pl.policy_conditions, pl.exclusions
       FROM policies p
       JOIN quotes q ON q.quote_id = p.quote_id
       JOIN plans pl ON pl.plan_id = q.plan_id
       WHERE p.policy_id = ? AND p.user_id = ?`,
      [validation.policyId, userId]
    );
    if (!policies.length) return { statusCode: 404, message: "The simulated policy was not found for your account." };

    const [benefits] = await pool.query(
      `SELECT benefit_id, plan_id, benefit_name, benefit_category, benefit_limit, currency_code,
              required_evidence, exclusions_conditions
       FROM plan_benefits
       WHERE benefit_id = ? AND is_active = 1`,
      [benefitId]
    );
    if (!benefits.length) return { statusCode: 404, message: "The selected benefit is not active." };

    const policy = policies[0];
    const benefit = benefits[0];
    if (input.benefit_category && !matchesBenefitForDisruption(input.benefit_category, benefit.benefit_category)) {
      return { statusCode: 409, message: "The selected benefit does not match the disruption category. Choose the matching benefit and recheck." };
    }
    const result = evaluateClaimEligibility({
      policy,
      benefit,
      incidentDate: validation.incidentDate,
      claimedAmount: validation.claimedAmount,
      verification,
      hasTicket,
      supportingDocumentCount,
    });
    return { validation, benefitId, flightNumber, flightDate, verification, policy, benefit, result };
  }

  router.post("/eligibility", async (req, res) => {
    try {
      const context = await getEligibilityContext(
        req.body || {},
        req.user.userId,
        req.body?.has_ticket === "true" || req.body?.has_ticket === true,
        Number(req.body?.supporting_document_count || 0)
      );
      if (context.message) {
        return res.status(context.statusCode).json({ success: false, message: context.message });
      }
      return res.json({ success: true, data: context.result, educational_simulation: true });
    } catch (error) {
      console.error("Failed to evaluate simulated claim eligibility:", error.message);
      return res.status(500).json({ success: false, message: "Unable to evaluate claim requirements." });
    }
  });

  function parseEvidenceUploads(files, body) {
    const ticket = files?.ticket?.[0];
    const supporting = files?.supporting || [];
    const labels = Array.isArray(body?.supporting_label)
      ? body.supporting_label
      : body?.supporting_label
        ? [body.supporting_label]
        : [];
    return ticket ? [
      { file: ticket, kind: "ticket", label: "Flight ticket" },
      ...supporting.map((file, index) => ({ file, kind: "supporting", label: labels[index] || null })),
    ] : null;
  }

  router.post(
    "/",
    (req, res, next) => {
      evidenceUpload.fields([{ name: "ticket", maxCount: 1 }, { name: "supporting", maxCount: 9 }])(req, res, (error) => {
        if (error instanceof multer.MulterError) {
          const message = error.code === "LIMIT_FILE_SIZE"
            ? "Each evidence file must be 10 MB or smaller."
            : "The evidence upload is invalid or contains too many files.";
          return res.status(400).json({ success: false, message });
        }
        if (error) return res.status(400).json({ success: false, message: "The evidence upload is invalid." });
        return next();
      });
    },
    async (req, res) => {
      let connection;
      const savedFiles = [];
      try {
        const evidence = parseEvidenceUploads(req.files, req.body);
        if (!evidence) {
          return res.status(400).json({ success: false, message: "Upload a flight ticket before submitting." });
        }

        const context = await getEligibilityContext(
          req.body || {},
          req.user.userId,
          true,
          (req.files?.supporting || []).length
        );
        if (context.message) {
          return res.status(context.statusCode).json({ success: false, message: context.message });
        }
        if (!context.result.eligibleToSubmit) {
          return res.status(409).json({ success: false, data: context.result, message: "The configured claim checks need more information." });
        }
        const uploadedLabels = evidence.filter((item) => item.kind === "supporting").map((item) => item.label);
        if (
          uploadedLabels.length !== context.result.requiredEvidence.length ||
          context.result.requiredEvidence.some((label) => !uploadedLabels.includes(label))
        ) {
          return res.status(400).json({ success: false, message: "Attach one supporting file for each required checklist item." });
        }

        const validatedEvidence = [];
        for (const item of evidence) {
          const validation = await validateEvidenceFile(item.file);
          if (validation.message) return res.status(400).json({ success: false, message: validation.message });
          validatedEvidence.push({ ...item, validation });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [lockedPolicies] = await connection.query(
          `SELECT p.policy_id, p.policy_number, p.policy_status,
            DATE_FORMAT(p.coverage_start_date, '%Y-%m-%d') AS coverage_start_date,
            DATE_FORMAT(p.coverage_end_date, '%Y-%m-%d') AS coverage_end_date,
            p.currency_code,
                  q.plan_id, pl.coverage_amount, pl.policy_conditions, pl.exclusions
           FROM policies p
           JOIN quotes q ON q.quote_id = p.quote_id
           JOIN plans pl ON pl.plan_id = q.plan_id
           WHERE p.policy_id = ? AND p.user_id = ? FOR UPDATE`,
          [context.validation.policyId, req.user.userId]
        );
        if (!lockedPolicies.length) {
          await rollbackSafely(connection);
          return res.status(404).json({ success: false, message: "The simulated policy was not found for your account." });
        }

        const [lockedBenefits] = await connection.query(
          `SELECT benefit_id, plan_id, benefit_name, benefit_category, benefit_limit, currency_code,
                  required_evidence, exclusions_conditions
           FROM plan_benefits
           WHERE benefit_id = ? AND plan_id = ? AND is_active = 1 FOR UPDATE`,
          [context.benefitId, lockedPolicies[0].plan_id]
        );
        if (!lockedBenefits.length) {
          await rollbackSafely(connection);
          return res.status(409).json({ success: false, message: "The selected benefit is no longer available for this policy." });
        }
        if (req.body?.benefit_category && !matchesBenefitForDisruption(req.body.benefit_category, lockedBenefits[0].benefit_category)) {
          await rollbackSafely(connection);
          return res.status(409).json({ success: false, message: "The selected benefit no longer matches this disruption category. Recheck your claim." });
        }

        const finalResult = evaluateClaimEligibility({
          policy: lockedPolicies[0],
          benefit: lockedBenefits[0],
          incidentDate: context.validation.incidentDate,
          claimedAmount: context.validation.claimedAmount,
          verification: context.verification,
          hasTicket: true,
          supportingDocumentCount: req.files?.supporting?.length || 0,
        });
        if (!finalResult.eligibleToSubmit) {
          await rollbackSafely(connection);
          return res.status(409).json({ success: false, data: finalResult, message: "The configured claim checks need more information." });
        }

        for (const item of validatedEvidence) {
          const saved = await saveEvidenceFile(item.file, item.validation.extension);
          savedFiles.push({ ...saved, ...item });
        }

        const claimNumber = createClaimNumber();
        const claimStatus = finalResult.eligibilityStatus === "MANUAL_REVIEW" ? "under_review" : "submitted";
        const [claim] = await connection.query(
          `INSERT INTO claims
           (claim_number, user_id, policy_id, benefit_id, flight_number, flight_date,
            flight_verification_status, claim_status, incident_date, description,
            claimed_amount, currency_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            claimNumber,
            req.user.userId,
            context.validation.policyId,
            context.benefitId,
            context.flightNumber,
            context.flightDate,
            context.verification.verificationStatus,
            claimStatus,
            context.validation.incidentDate,
            context.validation.description,
            context.validation.claimedAmount,
            lockedPolicies[0].currency_code,
          ]
        );

        for (const item of savedFiles) {
          await connection.query(
            `INSERT INTO claim_evidence_documents
             (claim_id, original_filename, storage_name, mime_type, file_size, evidence_kind, evidence_label)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [claim.insertId, item.validation.originalFilename, item.storageName, item.validation.mimeType, item.file.size, item.kind, item.label]
          );
        }
        await createUserNotification(connection, {
          userId: req.user.userId,
          type: "document_added",
          title: "Claim documents added",
          message: `Evidence for claim ${claimNumber} is available in Documents.`,
          relatedType: "claim",
          relatedId: claim.insertId,
        });
        await connection.commit();

        return res.status(201).json({
          success: true,
          message: claimStatus === "under_review"
            ? "Claim simulation submitted for manual review."
            : "Claim simulation submitted after configured checks passed.",
          data: {
            claim_id: claim.insertId,
            claim_number: claimNumber,
            claim_status: claimStatus,
            policy_id: context.policy.policy_id,
            policy_number: context.policy.policy_number,
            benefit_id: context.benefitId,
            benefit_name: lockedBenefits[0].benefit_name,
            flight_number: context.flightNumber,
            flight_date: context.flightDate,
            flight_verification_status: context.verification.verificationStatus,
            eligibility_status: finalResult.eligibilityStatus,
            evidence_count: savedFiles.length,
          },
          educational_simulation: true,
          disclaimer: "Educational simulation only. Flight data and uploaded evidence do not establish real coverage, eligibility, approval, or reimbursement.",
        });
      } catch (error) {
        if (connection) await rollbackSafely(connection);
        for (const file of savedFiles) {
          try {
            await unlink(file.storagePath);
          } catch (cleanupError) {
            console.error("Failed to clean up evidence file:", cleanupError.message);
          }
        }
        console.error("Failed to submit verified simulated claim:", error.message);
        return res.status(500).json({ success: false, message: "Unable to submit the simulated claim and evidence." });
      } finally {
        if (connection) connection.release();
      }
    }
  );

export default router;
