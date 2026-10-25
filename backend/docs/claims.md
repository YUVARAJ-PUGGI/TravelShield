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

Claimed amounts are illustrative inputs only. The current simulation does not
check them against benefit sub-limits, deductibles, accumulated claims, or
necessarily the policy's overall coverage limit. No claim submitted through
these endpoints implies eligibility, approval, reimbursement, payment, or
settlement.

The claims table is created by the additive migration
`backend/sql/005_create_claims.sql`. Apply it manually, after the existing
policies table migration, using the project's normal MySQL migration process.
This implementation does not apply migrations automatically.

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

The upload validation detects PDF, JPEG, and PNG signatures from the file
contents rather than trusting the browser filename or MIME type. This phase
does not implement OCR, claim approval, reimbursement, or real payouts.
