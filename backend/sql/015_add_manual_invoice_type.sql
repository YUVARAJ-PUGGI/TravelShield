USE travelshield;

ALTER TABLE billing_invoices
  MODIFY COLUMN invoice_type ENUM('policy_purchase', 'claim_settlement', 'manual')
    NOT NULL DEFAULT 'policy_purchase';
