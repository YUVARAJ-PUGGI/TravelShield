USE travelshield;

CREATE TABLE IF NOT EXISTS user_documents (
  document_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  policy_id INT NULL,
  claim_id INT NULL,
  invoice_id INT NULL,
  original_filename VARCHAR(180) NOT NULL,
  storage_name VARCHAR(80) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  document_category ENUM('policy', 'claim', 'invoice_receipt', 'uploaded') NOT NULL,
  document_type VARCHAR(60) NOT NULL,
  document_status ENUM('available', 'pending', 'archived') NOT NULL DEFAULT 'available',
  uploaded_by_user TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id),
  UNIQUE KEY uq_user_documents_storage_name (storage_name),
  KEY idx_user_documents_owner_created (user_id, created_at),
  KEY idx_user_documents_policy (policy_id),
  KEY idx_user_documents_claim (claim_id),
  KEY idx_user_documents_invoice (invoice_id),
  CONSTRAINT fk_user_documents_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_documents_policy
    FOREIGN KEY (policy_id) REFERENCES policies (policy_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_documents_claim
    FOREIGN KEY (claim_id) REFERENCES claims (claim_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_documents_invoice
    FOREIGN KEY (invoice_id) REFERENCES billing_invoices (invoice_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_user_documents_size
    CHECK (file_size > 0 AND file_size <= 10485760)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_notifications (
  notification_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  notification_type ENUM('document_added', 'invoice_created', 'payment_updated', 'policy_activated') NOT NULL,
  title VARCHAR(160) NOT NULL,
  message VARCHAR(500) NOT NULL,
  related_type VARCHAR(32) NULL,
  related_id INT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  KEY idx_user_notifications_owner_created (user_id, created_at),
  KEY idx_user_notifications_unread (user_id, read_at),
  CONSTRAINT fk_user_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;