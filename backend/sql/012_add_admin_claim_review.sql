USE travelshield;

ALTER TABLE users
  ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE claims
  ADD COLUMN reviewer_user_id INT NULL,
  ADD COLUMN reviewed_at TIMESTAMP NULL,
  ADD COLUMN review_notes TEXT NULL,
  ADD KEY idx_claims_reviewer (reviewer_user_id),
  ADD CONSTRAINT fk_claims_reviewer
    FOREIGN KEY (reviewer_user_id) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE user_notifications
  MODIFY COLUMN notification_type ENUM(
    'document_added',
    'invoice_created',
    'payment_updated',
    'policy_activated',
    'claim_reviewed'
  ) NOT NULL;