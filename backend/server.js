
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./src/config/db.js";
import planRoutes from "./src/routes/planRoutes.js";
import quoteRoutes from "./src/routes/quoteRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import countryRoutes from "./src/routes/countryRoutes.js";
import policyRoutes from "./src/routes/policyRoutes.js";
import claimRoutes from "./src/routes/claimRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/plans", planRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/countries", countryRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/claims", claimRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to TravelShield Abroad API",
  });
});

app.get("/api/health/db", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS connected");

    res.json({
      message: "MySQL connection successful",
      databaseConnected: rows[0].connected === 1,
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(500).json({
      message: "Database connection failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
