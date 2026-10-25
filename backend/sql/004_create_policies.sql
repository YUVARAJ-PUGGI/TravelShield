USE travelshield;

-- Educational simulation only. This table does not represent real insurance.
-- This migration is additive and does not change existing users, quotes, plans,
-- countries, or coverage rules.
CREATE TABLE IF NOT EXISTS policies (
  policy_id INT NOT NULL AUTO_INCREMENT,
  policy_number VARCHAR(40) NOT NULL,
  user_id INT NOT NULL,
  quote_id INT NOT NULL,
  policy_status ENUM('simulated_issued', 'simulated_cancelled') NOT NULL
    DEFAULT 'simulated_issued',
  issue_date DATE NOT NULL,
  coverage_start_date DATE NOT NULL,
  coverage_end_date DATE NOT NULL,
  premium_amount DECIMAL(12,2) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (policy_id),
  UNIQUE KEY uq_policies_policy_number (policy_number),
  UNIQUE KEY uq_policies_quote_id (quote_id),
  KEY idx_policies_user_id (user_id),
  CONSTRAINT fk_policies_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_policies_quote
    FOREIGN KEY (quote_id) REFERENCES quotes (quote_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_policies_dates
    CHECK (coverage_end_date >= coverage_start_date),
  CONSTRAINT chk_policies_premium
    CHECK (premium_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

