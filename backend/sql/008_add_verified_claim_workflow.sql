USE travelshield;

ALTER TABLE claims
  ADD COLUMN benefit_id INT NULL,
  ADD COLUMN flight_number VARCHAR(16) NULL,
  ADD COLUMN flight_date DATE NULL,
  ADD COLUMN flight_verification_status ENUM('RECORD_FOUND', 'MANUAL_REVIEW')
    NOT NULL DEFAULT 'MANUAL_REVIEW',
  ADD KEY idx_claims_benefit_id (benefit_id),
  ADD CONSTRAINT fk_claims_benefit
    FOREIGN KEY (benefit_id) REFERENCES plan_benefits (benefit_id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE claim_evidence_documents
  ADD COLUMN evidence_kind ENUM('ticket', 'supporting')
    NOT NULL DEFAULT 'supporting',
  ADD COLUMN evidence_label VARCHAR(180) NULL;