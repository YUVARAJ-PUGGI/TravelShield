# Educational Claims Simulation

The claims endpoints are an educational simulation only. They do not provide
insurance claims processing and do not represent approval, reimbursement,
payment, settlement, or real coverage.

## Endpoints

All endpoints require the existing bearer authentication middleware:

- `GET /api/claims` lists simulated claims belonging to the signed-in user.
- `GET /api/claims/:claimId` returns one simulated claim belonging to the
  signed-in user.
- `POST /api/claims` submits a simulated claim against an owned policy whose
  status is `simulated_issued`.

Claim submission requires `policy_id`, `incident_date`, `description`, and
`claimed_amount`. The server derives the user from the authenticated token and
uses the policy's currency. Incident dates must be valid, not future dates, and
must fall inclusively between the policy coverage start and end dates.

Claimed amounts are illustrative inputs only. The current simulation does not
check them against benefit sub-limits, deductibles, accumulated claims, or
necessarily the policy's overall coverage limit. No claim submitted through
these endpoints implies eligibility, approval, reimbursement, payment, or
settlement.

The claims table is created by the additive migration
`backend/sql/005_create_claims.sql`. Apply it manually, after the existing
policies table migration, using the project's normal MySQL migration process.
This implementation does not apply migrations automatically.
