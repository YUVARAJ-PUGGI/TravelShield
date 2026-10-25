# Educational Claims Simulation

The claims endpoints are an educational simulation only. They do not provide
insurance claims processing and do not represent approval, reimbursement,
payment, settlement, or real coverage.

## Endpoints

All endpoints require the existing bearer authentication middleware:

- `POST /api/flights/verify` checks a flight number and date with Aviationstack
  and returns a short-lived signed result token. Provider errors and unmatched
  flights are marked for manual review.
- `GET /api/claims` lists simulated claims belonging to the signed-in user.
- `GET /api/claims/:claimId` returns one simulated claim belonging to the
  signed-in user.
- `POST /api/claims` submits a simulated claim against an owned policy whose
  status is `simulated_issued`. Send multipart form data with `ticket`, one or
  more `supporting` files, matching repeated `supporting_label` fields, the
  claim fields, and a signed flight-verification token.
- `POST /api/claims/eligibility` checks the authenticated user's policy,
  selected benefit, flight verification, amount, and required-document count
  before submission. It does not save a claim or evidence.
- `GET /api/claims/:claimId/evidence` lists private evidence metadata for an
  owned simulated claim.
- `POST /api/claims/:claimId/evidence` uploads one PDF, JPEG, or PNG evidence
  document for an owned simulated claim. Files are limited to 10 MB.
- `GET /api/claims/:claimId/evidence/:documentId/download` downloads an owned
  evidence document through the authenticated API; it is not a public URL.

Claim submission requires `policy_id`, `incident_date`, `description`, and
`claimed_amount`. The server derives the user from the authenticated token and
uses the policy's currency. Incident dates must be valid, not future dates, and
must fall inclusively between the policy coverage start and end dates.

## Flight claim workflow

The claim form collects a flight ticket (PDF, JPEG, or PNG), flight number,
flight date, simulated policy, benefit, incident details, claimed amount, and
the benefit's required supporting documents. It calls
`POST /api/flights/verify`, then `POST /api/claims/eligibility`, and submits the
claim and files together only after the configured checks pass.

Flight verification requires both a flight number and a valid `YYYY-MM-DD`
date. A matching provider record is compared by exact normalized flight number
and date. The verification endpoint returns a short-lived signed token; claim
eligibility and submission validate that token, so a client cannot simply claim
that a provider check passed. Tickets are not OCR-processed, and the backend
does not validate file contents against the entered flight details.

Provider outages, subscription restrictions, invalid provider configuration,
and unmatched flights produce a manual-review result instead of a denial.
Concrete configured failures (for example, coverage dates or a benefit limit)
return their specific reason and applicable condition. Plan text currently
contains proposed and unconfigured conditions, so those submissions are saved
with `under_review`; a matching flight record is not an approval or proof of
eligibility. All behavior remains an educational simulation.

Claimed amounts are illustrative inputs only. The current simulation does not
check them against benefit sub-limits, deductibles, accumulated claims, or
necessarily the policy's overall coverage limit. No claim submitted through
these endpoints implies eligibility, approval, reimbursement, payment, or
settlement.

The claims table is created by the additive migration
`backend/sql/005_create_claims.sql`. Apply it manually, after the existing
policies table migration, using the project's normal MySQL migration process.
This implementation does not apply migrations automatically.

The flight claim workflow also requires plan benefits and its additive schema
update. Apply migrations in this order if they have not already been applied:

```powershell
mysql -u <user> -p travelshield_db < backend\sql\007_create_plan_benefits.sql
mysql -u <user> -p travelshield_db < backend\sql\008_add_verified_claim_workflow.sql
```

The 008 migration adds benefit and flight references to claims and evidence
labels to uploaded documents. Apply it once after migration 007; it does not
run automatically at server startup.

## Evidence storage setup

Apply the evidence metadata migration manually after the claims migration:

```sh
mysql -u <user> -p travelshield_db < backend/sql/006_create_claim_evidence.sql
```

Set `EVIDENCE_STORAGE_DIR` in the backend environment to a private directory
that is not inside `frontend/public`, `frontend/dist`, or any other static
directory. The default is `backend/private-storage/evidence` when the server
is started from `backend`. Ensure the backend process can create the directory
and write files there, and back it up using your private infrastructure if
needed. Uploaded files are stored with generated names and are ignored by
Git; never put environment files, SQL backups, or uploaded evidence into
source control.

Upload validation detects PDF, JPEG, and PNG signatures from file contents
rather than trusting the browser filename or MIME type. The workflow does not
perform OCR, claim approval, reimbursement, or real payouts.
