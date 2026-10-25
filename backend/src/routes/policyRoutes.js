import { Router } from "express";
import pool from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const policySelect = `
  SELECT p.policy_id, p.policy_number, p.policy_status,
         DATE_FORMAT(p.issue_date, '%Y-%m-%d') AS issue_date,
         DATE_FORMAT(p.coverage_start_date, '%Y-%m-%d') AS coverage_start_date,
         DATE_FORMAT(p.coverage_end_date, '%Y-%m-%d') AS coverage_end_date,
         p.premium_amount,
         p.currency_code, p.created_at, p.updated_at, p.quote_id,
         q.plan_id, q.destination_country_id, q.traveller_count,
         q.quote_status, pl.plan_name, pl.coverage_amount,
         pl.policy_conditions, c.country_name
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

router.post("/issue", (_req, res) => {
  return res.status(409).json({
    success: false,
    message: "Direct policy issuance is disabled. Open Billing, create an invoice from your saved quote, then confirm a demo payment to activate the simulated policy.",
    educational_simulation: true,
  });
});

export default router;
