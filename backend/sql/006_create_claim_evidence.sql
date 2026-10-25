USE travelshield_db;

-- Educational simulation only. Evidence documents are private user uploads.
CREATE TABLE IF NOT EXISTS claim_evidence_documents (
  document_id INT NOT NULL AUTO_INCREMENT,
  claim_id INT NOT NULL,
  original_filename VARCHAR(180) NOT NULL,
  storage_name VARCHAR(80) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id),
  UNIQUE KEY uq_claim_evidence_storage_name (storage_name),
  KEY idx_claim_evidence_claim_id (claim_id),
  CONSTRAINT fk_claim_evidence_claim
    FOREIGN KEY (claim_id) REFERENCES claims (claim_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_claim_evidence_file_size
    CHECK (file_size > 0 AND file_size <= 10485760)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
