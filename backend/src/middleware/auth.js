import crypto from "node:crypto";
import dotenv from "dotenv";
import pool from "../config/db.js";

dotenv.config();

const authSecret = process.env.AUTH_SECRET?.trim();
if (!authSecret || authSecret === "replace-with-a-long-random-secret") {
  throw new Error(
    "AUTH_SECRET must be set to a stable, non-placeholder value in the backend environment."
  );
}
const tokenLifetimeSeconds = 24 * 60 * 60;

function sign(value) {
  return crypto
    .createHmac("sha256", authSecret)
    .update(value)
    .digest("base64url");
}

export function createAuthToken(userId) {
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + tokenLifetimeSeconds}`;
  return `${payload}.${sign(payload)}`;
}

export function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });
  }

  const [userIdText, expiresAtText, signature] = parts;
  const payload = `${userIdText}.${expiresAtText}`;
  const expectedSignature = sign(payload);
  const signatureMatches =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

  if (
    !signatureMatches ||
    !/^\d+$/.test(userIdText) ||
    !/^\d+$/.test(expiresAtText) ||
    Number(expiresAtText) < Math.floor(Date.now() / 1000)
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }

  req.user = { userId: Number(userIdText) };
  return next();
}

export async function requireAdmin(req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT is_admin FROM users WHERE user_id = ?",
      [req.user.userId]
    );
    if (!rows.length || !rows[0].is_admin) {
      return res.status(403).json({
        success: false,
        message: "Administrator access is required for claim review.",
      });
    }
    return next();
  } catch (error) {
    console.error("Failed to check admin access:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to verify administrator access.",
    });
  }
}
