USE travelshield;

ALTER TABLE policies
  MODIFY COLUMN policy_status ENUM(
    'simulated_pending_payment',
    'simulated_issued',
    'simulated_cancelled'
  ) NOT NULL DEFAULT 'simulated_pending_payment';

CREATE TABLE IF NOT EXISTS billing_invoices (
  invoice_id INT NOT NULL AUTO_INCREMENT,
  invoice_number VARCHAR(40) NOT NULL,
  policy_id INT NOT NULL,
  quote_id INT NOT NULL,
  user_id INT NOT NULL,
  premium_amount DECIMAL(12,2) NOT NULL,
  tax_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  payment_status ENUM('PENDING', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING',
  payment_provider ENUM('demo') NOT NULL DEFAULT 'demo',
  payment_reference VARCHAR(80) NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (invoice_id),
  UNIQUE KEY uq_billing_invoice_number (invoice_number),
  UNIQUE KEY uq_billing_quote (quote_id),
  UNIQUE KEY uq_billing_policy (policy_id),
  KEY idx_billing_user_created (user_id, created_at),
  KEY idx_billing_payment_status (payment_status),
  CONSTRAINT fk_billing_policy
    FOREIGN KEY (policy_id) REFERENCES policies (policy_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_billing_quote
    FOREIGN KEY (quote_id) REFERENCES quotes (quote_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_billing_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_billing_amounts
    CHECK (premium_amount >= 0 AND tax_amount >= 0 AND fee_amount >= 0 AND total_amount >= 0),
  CONSTRAINT chk_billing_tax_rate
    CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;