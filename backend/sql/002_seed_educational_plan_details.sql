USE travelshield_db;

START TRANSACTION;

UPDATE plans
SET
  coverage_benefits = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative emergency assistance example',
      'description', 'A hypothetical educational example of travel assistance; it is not a promise of reimbursement or real insurance coverage.'
    ),
    JSON_OBJECT(
      'title', 'Illustrative trip disruption example',
      'description', 'A hypothetical educational example of discussing an interrupted trip; actual benefits are not configured in this demo.'
    )
  ),
  exclusions = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative exclusions only',
      'description', 'No real exclusions are defined here; this section is only an educational placeholder and is not policy wording.'
    )
  ),
  eligibility_requirements = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative eligibility checkpoint',
      'description', 'A hypothetical reminder to review trip and traveller information; real eligibility requirements are not configured.'
    )
  ),
  policy_conditions = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative documentation condition',
      'description', 'A hypothetical reminder to retain trip information; real policy conditions are not configured.'
    )
  )
WHERE plan_id = 1;

UPDATE plans
SET
  coverage_benefits = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative trip interruption example',
      'description', 'A hypothetical educational example of trip disruption support; it is not a promise of reimbursement or real insurance coverage.'
    ),
    JSON_OBJECT(
      'title', 'Illustrative baggage assistance example',
      'description', 'A hypothetical educational example of reporting delayed belongings; actual benefits are not configured in this demo.'
    )
  ),
  exclusions = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative exclusions only',
      'description', 'No real exclusions are defined here; this section is only an educational placeholder and is not policy wording.'
    )
  ),
  eligibility_requirements = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative eligibility checkpoint',
      'description', 'A hypothetical reminder to review trip and traveller information; real eligibility requirements are not configured.'
    )
  ),
  policy_conditions = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative notification condition',
      'description', 'A hypothetical reminder to report a demo event promptly; real policy conditions are not configured.'
    )
  )
WHERE plan_id = 2;

UPDATE plans
SET
  coverage_benefits = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative broad travel assistance example',
      'description', 'A hypothetical educational example of coordinating several travel-support scenarios; it is not real insurance coverage.'
    ),
    JSON_OBJECT(
      'title', 'Illustrative higher-limit scenario example',
      'description', 'A hypothetical educational example associated with the Premium demo tier; it does not promise any real benefit or payment.'
    )
  ),
  exclusions = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative exclusions only',
      'description', 'No real exclusions are defined here; this section is only an educational placeholder and is not policy wording.'
    )
  ),
  eligibility_requirements = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative eligibility checkpoint',
      'description', 'A hypothetical reminder to review trip and traveller information; real eligibility requirements are not configured.'
    )
  ),
  policy_conditions = JSON_ARRAY(
    JSON_OBJECT(
      'title', 'Illustrative coordination condition',
      'description', 'A hypothetical reminder to contact assistance before acting where practical; real policy conditions are not configured.'
    )
  )
WHERE plan_id = 3;

COMMIT;
