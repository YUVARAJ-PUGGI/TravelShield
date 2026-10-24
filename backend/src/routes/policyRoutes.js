import crypto from "node:crypto";
import { Router } from "express";
import pool from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateEligibleQuote } from "../utils/policyValidation.js";

const router = Router();

router.use(requireAuth);

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function createPolicyNumber() {
  return `TS-DEMO-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

function todayDateOnly() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

const policySelect = `
  SELECT p.policy_id, p.policy_number, p.policy_status, p.issue_date,
         p.coverage_start_date, p.coverage_end_date, p.premium_amount,
         p.currency_code, p.created_at, p.updated_at, p.quote_id,
         q.plan_id, q.destination_country_id, q.traveller_count,
         q.quote_status, pl.plan_name, c.country_name
  FROM policies p
  JOIN quotes q ON q.quote_id = p.quote_id
  JOIN plans pl ON pl.plan_id = q.plan_id
  JOIN countries c ON c.country_id = q.destination_country_id`;

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${policySelect}
       WHERE p.user_id = ? ORDER BY p.created_at DESC`,
      [req.user.userId]
    );
    return res.json({
      success: true,
      count: rows.length,
      data: rows,
      educational_simulation: true,
    });
  } catch (error) {
    console.error("Failed to fetch user policies:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch your simulated policies.",
    });
  }
});

router.get("/:policyId", async (req, res) => {
  const policyId = parsePositiveInteger(req.params.policyId);
  if (!policyId) {
    return res.status(400).json({
      success: false,
      message: "A valid policy ID is required.",
    });
  }

  try {
    const [rows] = await pool.query(
      `${policySelect} WHERE p.policy_id = ? AND p.user_id = ?`,
      [policyId, req.user.userId]
    );
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Simulated policy not found.",
      });
    }
    return res.json({
      success: true,
      data: rows[0],
      educational_simulation: true,
      disclaimer:
        "Educational simulation only — not an insurance policy or proof of coverage.",
    });
  } catch (error) {
    console.error("Failed to fetch simulated policy:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch the simulated policy.",
    });
  }
});

router.post("/issue", async (req, res) => {
  const quoteId = parsePositiveInteger(req.body?.quote_id);
  if (!quoteId) {
    return res.status(400).json({
      success: false,
      message: "A valid quote ID is required.",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [quotes] = await connection.query(
      `SELECT quote_id, user_id, destination_country_id, plan_id,
              DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
              traveller_count, premium_amount, currency_code, quote_status
       FROM quotes
       WHERE quote_id = ? AND user_id = ?
       FOR UPDATE`,
      [quoteId, req.user.userId]
    );
    if (!quotes.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "The quote was not found for the signed-in user.",
      });
    }

    const quote = quotes[0];
    const validationMessage = validateEligibleQuote(quote);
    if (validationMessage) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: validationMessage,
      });
    }

    const [existingPolicies] = await connection.query(
      "SELECT policy_id FROM policies WHERE quote_id = ? LIMIT 1",
      [quoteId]
    );
    if (existingPolicies.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "This quote already has a simulated policy.",
      });
    }

    const policyNumber = createPolicyNumber();
    const issueDate = todayDateOnly();
    const [result] = await connection.query(
      `INSERT INTO policies
       (policy_number, user_id, quote_id, policy_status, issue_date,
        coverage_start_date, coverage_end_date, premium_amount, currency_code)
       VALUES (?, ?, ?, 'simulated_issued', ?, ?, ?, ?, ?)`,
      [
        policyNumber,
        req.user.userId,
        quote.quote_id,
        issueDate,
        quote.start_date,
        quote.end_date,
        quote.premium_amount,
        quote.currency_code,
      ]
    );
    await connection.commit();

    return res.status(201).json({
      success: true,
      data: {
        policy_id: result.insertId,
        policy_number: policyNumber,
        quote_id: quote.quote_id,
        policy_status: "simulated_issued",
        issue_date: issueDate,
        coverage_start_date: quote.start_date,
        coverage_end_date: quote.end_date,
        premium_amount: quote.premium_amount,
        currency_code: quote.currency_code,
      },
      educational_simulation: true,
      disclaimer:
        "Educational simulation only — not an insurance policy or proof of coverage.",
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This quote already has a simulated policy.",
      });
    }
    console.error("Failed to issue simulated policy:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to issue the simulated policy.",
    });
  } finally {
    if (connection) connection.release();
  }
});

export default router;
