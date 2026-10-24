import crypto from "node:crypto";
import dotenv from "dotenv";

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
