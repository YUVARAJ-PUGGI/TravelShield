import { Router } from "express";
import pool from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { calculatePremium } from "../utils/quoteCalculator.js";
import { getInclusiveCalendarDays, normalizeDateOnly } from "../utils/dateOnly.js";

const router = Router();

router.use(requireAuth);

router.post("/", async (req, res) => {
  const {
    plan_id,
    destination_country_id,
    start_date,
    end_date,
    traveller_count = 1,
  } = req.body;
  const planId = Number(plan_id);
  const destinationCountryId = Number(destination_country_id);
  const travellerCount = Number(traveller_count);
  const normalizedStartDate = normalizeDateOnly(start_date);
  const normalizedEndDate = normalizeDateOnly(end_date);
  const today = new Date();
  const todayDateOnly = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (
    !Number.isInteger(planId) ||
    planId <= 0 ||
    !Number.isInteger(destinationCountryId) ||
    destinationCountryId <= 0 ||
    !Number.isInteger(travellerCount) ||
    travellerCount < 1 ||
    travellerCount > 20
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide valid plan, destination, and traveller values.",
    });
  }
  if (!normalizedStartDate || !normalizedEndDate) {
    return res.status(400).json({
      success: false,
      message: "Dates must be valid and use YYYY-MM-DD format.",
    });
  }
  if (normalizedStartDate > normalizedEndDate) {
    return res.status(400).json({
      success: false,
      message: "The trip end date must be on or after the start date.",
    });
  }
  if (normalizedStartDate < todayDateOnly) {
    return res.status(400).json({
      success: false,
      message: "The trip start date cannot be in the past.",
    });
  }

  const durationDays = getInclusiveCalendarDays(normalizedStartDate, normalizedEndDate);
  if (durationDays < 1 || durationDays > 365) {
    return res.status(400).json({
      success: false,
      message: "The trip must be between 1 and 365 inclusive calendar days.",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [plans] = await connection.query(
      `SELECT plan_id, plan_name, base_daily_rate, currency_code
       FROM plans WHERE plan_id = ? AND is_active = 1`,
      [planId]
    );
    if (!plans.length) {
      return res.status(404).json({
        success: false,
        message: "The selected plan does not exist or is inactive.",
      });
    }

    const [countries] = await connection.query(
      `SELECT country_id, country_name, currency_code
       FROM countries WHERE country_id = ? AND is_active = 1`,
      [destinationCountryId]
    );
    if (!countries.length) {
      return res.status(404).json({
        success: false,
        message: "The selected destination does not exist or is unsupported.",
      });
    }

    const plan = plans[0];
    const destination = countries[0];
    const dailyRate = Number(plan.base_daily_rate);
    if (!Number.isFinite(dailyRate) || dailyRate < 0) {
      throw new Error("Invalid daily rate configured for this plan.");
    }
    const premiumAmount = calculatePremium(dailyRate, durationDays, travellerCount);
    const [result] = await connection.query(
      `INSERT INTO quotes
       (user_id, destination_country_id, plan_id, start_date, end_date,
        traveller_count, premium_amount, currency_code, quote_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generated')`,
      [
        req.user.userId,
        destinationCountryId,
        planId,
        normalizedStartDate,
        normalizedEndDate,
        travellerCount,
        premiumAmount,
        plan.currency_code,
      ]
    );

    return res.status(201).json({
      success: true,
      data: {
        quote_id: result.insertId,
        quote_reference: `QT-${result.insertId}`,
        plan_id: plan.plan_id,
        plan_name: plan.plan_name,
        destination_country_id: destination.country_id,
        destination_name: destination.country_name,
        start_date: normalizedStartDate,
        end_date: normalizedEndDate,
        duration_days: durationDays,
        traveller_count: travellerCount,
        daily_rate_per_traveller: dailyRate,
        currency_code: plan.currency_code,
        estimated_premium: premiumAmount,
        quote_status: "generated",
        pricing_basis: "Illustrative demo rate; not a binding insurance offer.",
      },
    });
  } catch (error) {
    console.error("Failed to create quote:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to save the quote.",
    });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT q.quote_id, CONCAT('QT-', q.quote_id) AS quote_reference,
              DATE_FORMAT(q.start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(q.end_date, '%Y-%m-%d') AS end_date,
              q.traveller_count,
              q.premium_amount, q.currency_code, q.quote_status, q.created_at,
              p.plan_id, p.plan_name, p.description, p.coverage_amount,
              p.base_daily_rate, p.coverage_benefits, p.exclusions,
              p.eligibility_requirements, p.policy_conditions, c.country_name
       FROM quotes q
       JOIN plans p ON p.plan_id = q.plan_id
       JOIN countries c ON c.country_id = q.destination_country_id
       WHERE q.user_id = ? ORDER BY q.created_at DESC`,
      [req.user.userId]
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("Failed to fetch user quotes:", error.message);
    return res.status(500).json({ success: false, message: "Unable to fetch your quotes." });
  }
});

export default router;
