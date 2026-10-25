
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
import billingRoutes from "./src/routes/billingRoutes.js";
import documentRoutes from "./src/routes/documentRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import adminClaimRoutes from "./src/routes/adminClaimRoutes.js";
import { verifyFlightDetails } from "./src/utils/flightVerification.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// -------------------- EXISTING API ROUTES --------------------

app.get("/api/test-route", (req, res) => {
  res.json({
    message: "Updated server.js is running",
  });
});

app.use("/api/plans", planRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/countries", countryRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin/claims", adminClaimRoutes);
app.use("/api/claims", claimRoutes);

// -------------------- ROOT ROUTE --------------------

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the TravelShield API",
  });
});

// -------------------- DATABASE HEALTH CHECK --------------------

app.get("/api/health/db", async (req, res) => {
  try {
    await pool.query("SELECT 1 AS connected");

    res.json({
      success: true,
      message: "Database connection successful",
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// -------------------- FLIGHT VERIFICATION --------------------

app.post("/api/flights/verify", async (req, res) => {
  try {
    const result = await verifyFlightDetails(req.body || {});
    const { statusCode = 200, ...response } = result;
    return res.status(statusCode).json(response);
  } catch (error) {
    console.error("Flight verification failed:", error.message);

    return res.status(500).json({
      success: false,
      verificationStatus: "API_ERROR",
      message:
        "An unexpected error occurred during flight verification. Please submit the details for manual review.",
    });
  }
});

// -------------------- START SERVER --------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
