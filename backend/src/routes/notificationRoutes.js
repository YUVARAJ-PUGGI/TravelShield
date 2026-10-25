import { Router } from "express";
import pool from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { parsePositiveInteger } from "../utils/claimValidation.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT notification_id, notification_type, title, message,
              related_type, related_id, read_at, created_at
       FROM user_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, notification_id DESC`,
      [req.user.userId]
    );
    return res.json({
      success: true,
      count: rows.length,
      unread_count: rows.filter((row) => !row.read_at).length,
      data: rows,
    });
  } catch (error) {
    console.error("Failed to fetch notifications:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load notifications." });
  }
});

router.patch("/:notificationId/read", async (req, res) => {
  const notificationId = parsePositiveInteger(req.params.notificationId);
  if (!notificationId) return res.status(400).json({ success: false, message: "A valid notification ID is required." });
  try {
    const [result] = await pool.query(
      `UPDATE user_notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE notification_id = ? AND user_id = ?`,
      [notificationId, req.user.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Notification not found." });
    return res.json({ success: true, message: "Notification marked as read." });
  } catch (error) {
    console.error("Failed to update notification:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update notification." });
  }
});

export default router;