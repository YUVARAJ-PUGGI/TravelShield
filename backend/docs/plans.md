# Educational plan benefits API

The plans and benefits are illustrative educational examples only. They are
not real insurance coverage, guarantees, reimbursement decisions, or policy
wording.

## Apply the benefits migration

Apply the existing plan migrations first, then apply the additive benefits
migration manually from the repository root:

```powershell
mysql -u <user> -p travelshield_db < backend\sql\007_create_plan_benefits.sql
```

The migration references the existing `plans` rows with IDs 1 (Essential), 2
(Comprehensive), and 3 (Premium). It does not recreate or alter the `plans`
table and does not change plan prices, overall limits, deductibles, or quote
calculations. Do not run migrations automatically from server startup.

## Endpoint

`GET /api/plans/:planId/benefits` is public-read, matching the existing
`GET /api/plans` convention. It returns only active benefits for the selected
plan, including the illustrative limit, currency, evidence checklist, and
conditions.

Invalid plan IDs return `400`. Database or configuration errors return a safe
`500` response without exposing SQL details.

This phase does not implement claim approval, payout calculations, OCR, or a
reviewer dashboard.
