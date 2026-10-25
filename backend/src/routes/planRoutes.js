import { Router } from "express";
import pool from "../config/db.js";
import { parsePositiveInteger } from "../utils/claimValidation.js";
import { normalizePlanBenefitRows } from "../utils/planBenefitValidation.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        plan_id,
        plan_name,
        description,
        coverage_amount,
        deductible_amount,
        base_daily_rate,
        currency_code,
        coverage_benefits,
        exclusions,
        eligibility_requirements,
        policy_conditions,
        is_active,
        created_at
      FROM plans
      WHERE is_active = 1
      ORDER BY base_daily_rate ASC`
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Failed to fetch active plans:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to fetch plans",
    });
  }
});

router.get("/:planId/benefits", async (req, res) => {
  const planId = parsePositiveInteger(req.params.planId);
  if (!planId) {
    return res.status(400).json({
      success: false,
      message: "A valid plan ID is required.",
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT benefit_id, plan_id, benefit_name, benefit_category,
              description, benefit_limit, currency_code, required_evidence,
              exclusions_conditions, is_active
       FROM plan_benefits
       WHERE plan_id = ? AND is_active = 1
       ORDER BY benefit_id ASC`,
      [planId]
    );

    return res.json({
      success: true,
      count: rows.length,
      data: normalizePlanBenefitRows(rows),
      educational_simulation: true,
    });
  } catch (error) {
    console.error("Failed to fetch active plan benefits:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch plan benefits.",
    });
  }
});

export default router;
