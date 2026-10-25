USE travelshield;

-- Add claim linkage to billing invoices so accepted claims can generate a settlement invoice.
ALTER TABLE billing_invoices
  ADD COLUMN claim_id INT NULL AFTER policy_id,
  ADD COLUMN invoice_type ENUM('policy_purchase', 'claim_settlement')
    NOT NULL DEFAULT 'policy_purchase' AFTER claim_id,
  ADD KEY idx_billing_claim_id (claim_id),
  ADD CONSTRAINT fk_billing_claim
    FOREIGN KEY (claim_id) REFERENCES claims (claim_id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace policy/quote-only uniqueness with type-aware uniqueness so a policy can
-- have both its purchase invoice and a claim settlement invoice.
ALTER TABLE billing_invoices
  DROP INDEX uq_billing_policy,
  DROP INDEX uq_billing_quote,
  ADD UNIQUE KEY uq_billing_policy_type (policy_id, invoice_type),
  ADD UNIQUE KEY uq_billing_quote_type (quote_id, invoice_type),
  ADD UNIQUE KEY uq_billing_claim (claim_id);
