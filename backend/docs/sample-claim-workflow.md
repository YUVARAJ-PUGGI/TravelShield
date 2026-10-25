# Sample Claim Workflow

Educational demo only. This sample does not establish real coverage, eligibility, approval, or reimbursement. Do not use fabricated documents for a real insurance claim.

## Before starting

- Start MySQL and the backend/frontend development servers.
- Apply the claim, evidence, plan-benefit, and verified-claim workflow migrations. See `claims.md` for the migration order.
- Sign in with an account that owns an issued simulated policy.
- Open the claim form at `/submit-claim`.

## Sample claim

Choose the following values in the form. Use a policy and incident date that fall inside that policy's coverage period; the sample date below is only valid if your policy covers it.

| Field | Sample value |
| --- | --- |
| Benefit | Travel delay |
| Flight number | QR572 |
| Flight date | 2026-10-25 |
| Incident date | 2026-10-25 |
| Claimed amount | 50.00 in the policy currency |
| Incident details | My flight was delayed, and I had to buy meals while waiting. |

Upload a flight ticket as a PDF, JPG, or PNG, maximum 10 MB. For the Travel delay benefit, the seeded checklist requires one file for each of these items:

- Original itinerary
- Carrier delay confirmation
- Expense receipts

Use genuine documents for a real claim. In a local demo, use documents that are clearly marked as test data and only in the educational simulation.

## Expected result

Click **Verify flight and check requirements**. The app calls `POST /api/flights/verify`, then `POST /api/claims/eligibility`.

The current Aviationstack subscription does not provide live flight verification, so expect a manual-review result. The plan's free-text conditions and exclusions also require human review. The app should allow submission for manual review rather than treating the provider limitation as a denial.

After clicking **Submit for manual review**, expect a generated claim reference, an `under_review` status, and a link to claim details. The detail page should list the ticket and supporting documents. No OCR is performed; files are validated by actual PDF/JPEG/PNG signatures, but the system does not inspect their contents against the checklist labels.

## Flight verification API example

This public endpoint checks a flight number and date. Provider failures or no exact match return `MANUAL_REVIEW`; a signed token is returned for later eligibility/submission requests.

```powershell
$body = @{
    flightNumber = "QR572"
    flightDate = "2026-10-25"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:5000/api/flights/verify" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body |
    Select-Object success, verificationStatus, message, searchedFlightNumber, searchedFlightDate
```

The UI handles the signed token and authenticated claim requests. Avoid printing or sharing the token; it is short-lived and bound to the entered flight number and date.

## If it does not work

- `Database connection failed`: check `DB_HOST`, `DB_USER`, and `DB_PASSWORD` in `backend/.env`, then restart the backend.
- `Unable to fetch plan benefits`: check that migration `007_create_plan_benefits.sql` ran against the configured database.
- New claim-schema or missing-column error: check that `008_add_verified_claim_workflow.sql` ran after the claims, evidence, and benefit migrations.
- No policies appear: sign in with the account that owns the issued simulated policy.
- Requirements are blocked: check the policy coverage dates, amount against the selected benefit limit, ticket upload, and one supporting file per checklist item.
