import crypto from "node:crypto";
import { Router } from "express";
import pool from "../config/db.js";
import { createAuthToken, requireAuth } from "../middleware/auth.js";

const router = Router();

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

async function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const actualHash = await hashPassword(password, salt);
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHash.split(":")[1], "hex");
  return (
    expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  );
}

function validateCredentials({ full_name, email, password }) {
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    return "Use a valid email and a password between 8 and 128 characters.";
  }
  if (
    full_name !== undefined &&
    (typeof full_name !== "string" ||
      full_name.trim().length < 2 ||
      full_name.trim().length > 150)
  ) {
    return "Full name must be between 2 and 150 characters.";
  }
  return null;
}

router.post("/register", async (req, res) => {
  const { full_name, email, password } = req.body;
  const validationMessage = validateCredentials({ full_name, email, password });
  if (validationMessage || full_name === undefined) {
    return res.status(400).json({
      success: false,
      message: validationMessage || "Full name is required.",
    });
  }

  try {
    const passwordHash = await hashPassword(password);
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES (?, ?, ?)`,
      [full_name.trim(), email.trim().toLowerCase(), passwordHash]
    );
    const token = createAuthToken(result.insertId);
    return res.status(201).json({
      success: true,
      data: { token, user: { user_id: result.insertId, full_name: full_name.trim(), email: email.trim().toLowerCase() } },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "An account with that email already exists.",
      });
    }
    console.error("Failed to register user:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to create the account.",
    });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const validationMessage = validateCredentials({ email, password });
  if (validationMessage) {
    return res.status(400).json({ success: false, message: validationMessage });
  }

  try {
    const [users] = await pool.query(
      `SELECT user_id, full_name, email, password_hash
       FROM users WHERE email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );
    const user = users[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({
        success: false,
        message: "Email or password is incorrect.",
      });
    }
    return res.json({
      success: true,
      data: {
        token: createAuthToken(user.user_id),
        user: { user_id: user.user_id, full_name: user.full_name, email: user.email },
      },
    });
  } catch (error) {
    console.error("Failed to sign in:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to sign in.",
    });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT user_id, full_name, email FROM users WHERE user_id = ?",
      [req.user.userId]
    );
    if (!users.length) {
      return res.status(401).json({ success: false, message: "User no longer exists." });
    }
    return res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error("Failed to fetch current user:", error.message);
    return res.status(500).json({ success: false, message: "Unable to fetch account." });
  }
});

export default router;
