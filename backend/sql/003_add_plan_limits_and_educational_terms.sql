USE travelshield;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE plans ADD COLUMN deductible_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'plans'
    AND column_name = 'deductible_amount'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

START TRANSACTION;

UPDATE plans
SET
  coverage_amount = CASE plan_id WHEN 1 THEN 35000 WHEN 2 THEN 75000 WHEN 3 THEN 150000 ELSE coverage_amount END,
  deductible_amount = CASE plan_id WHEN 1 THEN 100 WHEN 2 THEN 50 WHEN 3 THEN 0 ELSE deductible_amount END,
  coverage_benefits = CASE plan_id
    WHEN 1 THEN JSON_ARRAY(
      JSON_OBJECT('title', 'Emergency medical treatment', 'limit', '$25,000', 'description', 'Provisional educational-demo sub-limit: $25,000.'),
      JSON_OBJECT('title', 'Medical evacuation', 'limit', '$5,000', 'description', 'Provisional educational-demo sub-limit: $5,000.'),
      JSON_OBJECT('title', 'Repatriation of remains', 'limit', 'Not included', 'description', 'Not included in the Essential educational-demo plan.'),
      JSON_OBJECT('title', 'Personal liability', 'limit', 'Not included', 'description', 'Not included in the Essential educational-demo plan.'),
      JSON_OBJECT('title', 'Lost/stolen checked baggage', 'limit', '$250', 'description', 'Provisional educational-demo sub-limit: $250.'),
      JSON_OBJECT('title', 'Eligible travel delay', 'limit', '$100', 'description', 'Provisional educational-demo sub-limit: $100.'),
      JSON_OBJECT('title', 'Covered trip cancellation/interruption', 'limit', '$250', 'description', 'Provisional educational-demo sub-limit: $250.'),
      JSON_OBJECT('title', 'Education interruption', 'limit', 'Not included', 'description', 'Not included in the Essential educational-demo plan.'),
      JSON_OBJECT('title', 'Visa-related eligible expenses', 'limit', 'Assistance only', 'description', 'Visa/residency assistance only. No reimbursement or immigration outcome is guaranteed.'),
      JSON_OBJECT('title', 'Passport/document replacement', 'limit', '$100', 'description', 'Provisional educational-demo sub-limit: $100.'),
      JSON_OBJECT('title', 'Emergency accommodation', 'limit', '$200', 'description', 'Provisional educational-demo sub-limit: $200.'),
      JSON_OBJECT('title', 'Emergency return travel', 'limit', '$500', 'description', 'Provisional educational-demo sub-limit: $500; duplicate reimbursement is not permitted.'),
      JSON_OBJECT('title', 'Mental-health emergency treatment', 'limit', '$500', 'description', 'Provisional educational-demo sub-limit: $500, subject to the applicable waiting period.'),
      JSON_OBJECT('title', 'Hospital cash', 'limit', 'Not included', 'description', 'Not included in the Essential educational-demo plan.'),
      JSON_OBJECT('title', 'Accidental death/permanent disability', 'limit', 'Not included', 'description', 'Not included in the Essential educational-demo plan.'),
      JSON_OBJECT('title', '24/7 emergency assistance', 'limit', 'Included', 'description', 'Included as provisional educational-demo assistance.')
    )
    WHEN 2 THEN JSON_ARRAY(
      JSON_OBJECT('title', 'Emergency medical treatment', 'limit', '$50,000', 'description', 'Provisional educational-demo sub-limit: $50,000.'),
      JSON_OBJECT('title', 'Medical evacuation', 'limit', '$15,000', 'description', 'Provisional educational-demo sub-limit: $15,000.'),
      JSON_OBJECT('title', 'Repatriation of remains', 'limit', '$5,000', 'description', 'Provisional educational-demo sub-limit: $5,000.'),
      JSON_OBJECT('title', 'Personal liability', 'limit', '$25,000', 'description', 'Provisional educational-demo sub-limit: $25,000.'),
      JSON_OBJECT('title', 'Lost/stolen checked baggage', 'limit', '$750', 'description', 'Provisional educational-demo sub-limit: $750.'),
      JSON_OBJECT('title', 'Eligible travel delay', 'limit', '$300', 'description', 'Provisional educational-demo sub-limit: $300.'),
      JSON_OBJECT('title', 'Covered trip cancellation/interruption', 'limit', '$1,000', 'description', 'Provisional educational-demo sub-limit: $1,000.'),
      JSON_OBJECT('title', 'Education interruption', 'limit', '$1,000', 'description', 'Provisional educational-demo sub-limit: $1,000, limited to defined eligible non-refundable expenses and covered events.'),
      JSON_OBJECT('title', 'Visa-related eligible expenses', 'limit', '$500', 'description', 'Specified eligible visa-related expenses only; no visa approval or immigration outcome is guaranteed.'),
      JSON_OBJECT('title', 'Passport/document replacement', 'limit', '$250', 'description', 'Provisional educational-demo sub-limit: $250.'),
      JSON_OBJECT('title', 'Emergency accommodation', 'limit', '$600', 'description', 'Provisional educational-demo sub-limit: $600.'),
      JSON_OBJECT('title', 'Emergency return travel', 'limit', '$1,500', 'description', 'Provisional educational-demo sub-limit: $1,500; duplicate reimbursement is not permitted.'),
      JSON_OBJECT('title', 'Mental-health emergency treatment', 'limit', '$1,000', 'description', 'Provisional educational-demo sub-limit: $1,000, subject to the applicable waiting period.'),
      JSON_OBJECT('title', 'Hospital cash', 'limit', '$25/day, maximum 10 days', 'description', 'Provisional educational-demo hospital-cash limit.'),
      JSON_OBJECT('title', 'Accidental death/permanent disability', 'limit', '$5,000', 'description', 'Provisional educational-demo sub-limit: $5,000.'),
      JSON_OBJECT('title', '24/7 emergency assistance', 'limit', 'Included', 'description', 'Included as provisional educational-demo assistance.')
    )
    WHEN 3 THEN JSON_ARRAY(
      JSON_OBJECT('title', 'Emergency medical treatment', 'limit', '$100,000', 'description', 'Provisional educational-demo sub-limit: $100,000.'),
      JSON_OBJECT('title', 'Medical evacuation', 'limit', '$30,000', 'description', 'Provisional educational-demo sub-limit: $30,000.'),
      JSON_OBJECT('title', 'Repatriation of remains', 'limit', '$10,000', 'description', 'Provisional educational-demo sub-limit: $10,000.'),
      JSON_OBJECT('title', 'Personal liability', 'limit', '$50,000', 'description', 'Provisional educational-demo sub-limit: $50,000.'),
      JSON_OBJECT('title', 'Lost/stolen checked baggage', 'limit', '$1,500', 'description', 'Provisional educational-demo sub-limit: $1,500.'),
      JSON_OBJECT('title', 'Eligible travel delay', 'limit', '$600', 'description', 'Provisional educational-demo sub-limit: $600.'),
      JSON_OBJECT('title', 'Covered trip cancellation/interruption', 'limit', '$2,500', 'description', 'Provisional educational-demo sub-limit: $2,500.'),
      JSON_OBJECT('title', 'Education interruption', 'limit', '$3,000', 'description', 'Provisional educational-demo sub-limit: $3,000, limited to defined eligible non-refundable expenses and covered events.'),
      JSON_OBJECT('title', 'Visa-related eligible expenses', 'limit', '$1,500', 'description', 'Specified eligible visa-related expenses only; no visa approval or immigration outcome is guaranteed.'),
      JSON_OBJECT('title', 'Passport/document replacement', 'limit', '$500', 'description', 'Provisional educational-demo sub-limit: $500.'),
      JSON_OBJECT('title', 'Emergency accommodation', 'limit', '$1,200', 'description', 'Provisional educational-demo sub-limit: $1,200.'),
      JSON_OBJECT('title', 'Emergency return travel', 'limit', '$3,000', 'description', 'Provisional educational-demo sub-limit: $3,000; duplicate reimbursement is not permitted.'),
      JSON_OBJECT('title', 'Mental-health emergency treatment', 'limit', '$2,000', 'description', 'Provisional educational-demo sub-limit: $2,000, subject to the applicable waiting period.'),
      JSON_OBJECT('title', 'Hospital cash', 'limit', '$50/day, maximum 15 days', 'description', 'Provisional educational-demo hospital-cash limit.'),
      JSON_OBJECT('title', 'Accidental death/permanent disability', 'limit', '$10,000', 'description', 'Provisional educational-demo sub-limit: $10,000.'),
      JSON_OBJECT('title', '24/7 emergency assistance', 'limit', 'Included', 'description', 'Included as provisional educational-demo assistance.')
    )
    ELSE coverage_benefits
  END,
  exclusions = JSON_ARRAY(
    JSON_OBJECT('title', 'Overall limit and sub-limits', 'description', 'All sub-limits are part of, and not additional to, the overall coverage limit.'),
    JSON_OBJECT('title', 'Duplicate reimbursement', 'description', 'The same expense cannot be reimbursed under evacuation, return travel, or another benefit more than once.'),
    JSON_OBJECT('title', 'Pre-existing conditions', 'description', 'Excluded in this initial educational-demo model.'),
    JSON_OBJECT('title', 'Known events', 'description', 'Known or foreseeable events and losses are excluded.'),
    JSON_OBJECT('title', 'Voluntary withdrawal and academic failure', 'description', 'These are not covered education-interruption events.'),
    JSON_OBJECT('title', 'Routine care and fraud', 'description', 'Routine care, fraudulent submissions, and unsupported expenses are excluded.'),
    JSON_OBJECT('title', 'Visa and immigration outcomes', 'description', 'No plan guarantees visa approval, residency, or any immigration outcome.')
  ),
  eligibility_requirements = JSON_ARRAY(
    JSON_OBJECT('title', 'Student eligibility', 'description', 'Students aged 18â€“35 with enrolment evidence; coverage duration is 1â€“365 days.')
  ),
  policy_conditions = JSON_ARRAY(
    JSON_OBJECT('title', 'Purchase timing', 'description', 'Purchase before departure for applicable pre-departure benefits.'),
    JSON_OBJECT('title', 'Waiting periods', 'description', 'Newly arising illness: 48 hours; mental-health emergency treatment: 14 days; education interruption: 30 days. Eligible accident emergency treatment starts at policy start.'),
    JSON_OBJECT('title', 'Free-look cancellation', 'description', 'Proposed 10-day free-look cancellation rule, subject to eligibility and final wording.'),
    JSON_OBJECT('title', 'Claims notice', 'description', 'Proposed claim notification within 30 days and document submission within 90 days; exceptions are reviewed rather than automatically rejected.'),
    JSON_OBJECT('title', 'Education interruption events', 'description', 'Closed proposed list: hospitalization for at least seven consecutive days; death of a documented financial sponsor; qualifying unexpected university closure; or a qualifying government-ordered travel restriction introduced after purchase. Reimbursement is limited to defined eligible, non-refundable expenses.'),
    JSON_OBJECT('title', 'Visa support', 'description', 'Essential provides visa/residency assistance only. Comprehensive and Premium reimburse only specified eligible visa-related expenses. No plan guarantees visa approval or immigration outcomes.'),
    JSON_OBJECT('title', 'Benefit coordination', 'description', 'Benefits are provisional educational examples, subject to the overall limit, and cannot duplicate reimbursement for the same expense.')
  )
WHERE plan_id IN (1, 2, 3);

COMMIT;

