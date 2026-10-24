import { Router } from "express";
import pool from "../config/db.js";

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

export default router;
