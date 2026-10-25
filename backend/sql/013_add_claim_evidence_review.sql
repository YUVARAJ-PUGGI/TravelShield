USE travelshield;

ALTER TABLE claim_evidence_documents
  ADD COLUMN review_status ENUM('pending', 'verified', 'needs_correction')
    NOT NULL DEFAULT 'pending',
  ADD COLUMN review_notes VARCHAR(1000) NULL,
  ADD COLUMN reviewed_by INT NULL,
  ADD COLUMN reviewed_at TIMESTAMP NULL,
  ADD KEY idx_claim_evidence_review_status (review_status),
  ADD CONSTRAINT fk_claim_evidence_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE;