USE travelshield_db;

-- Educational simulation only. This table does not represent real insurance
-- claims processing, approval, reimbursement, or settlement.
CREATE TABLE IF NOT EXISTS claims (
  claim_id INT NOT NULL AUTO_INCREMENT,
  claim_number VARCHAR(40) NOT NULL,
  user_id INT NOT NULL,
  policy_id INT NOT NULL,
  claim_status ENUM(
    'submitted',
    'under_review',
    'approved_demo',
    'declined_demo',
    'closed'
  ) NOT NULL DEFAULT 'submitted',
  incident_date DATE NOT NULL,
  description TEXT NOT NULL,
  claimed_amount DECIMAL(12,2) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (claim_id),
  UNIQUE KEY uq_claims_claim_number (claim_number),
  KEY idx_claims_user_id (user_id),
  KEY idx_claims_policy_id (policy_id),
  KEY idx_claims_status (claim_status),
  CONSTRAINT fk_claims_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_claims_policy
    FOREIGN KEY (policy_id) REFERENCES policies (policy_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_claims_amount
    CHECK (claimed_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
