import { Router } from "express";
import pool from "../config/db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT country_id, country_code, country_name, currency_code
       FROM countries WHERE is_active = 1 ORDER BY country_name`
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("Failed to fetch active countries:", error.message);
    return res.status(500).json({ success: false, message: "Unable to fetch destinations." });
  }
});

export default router;
