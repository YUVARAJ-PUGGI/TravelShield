USE travelshield;

ALTER TABLE billing_invoices
  MODIFY COLUMN payment_status ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED')
    NOT NULL DEFAULT 'PENDING',
  ADD COLUMN due_at DATE NULL AFTER created_at;

UPDATE billing_invoices
SET due_at = DATE_ADD(DATE(created_at), INTERVAL 7 DAY)
WHERE due_at IS NULL;