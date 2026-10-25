# Admin Claim Review (Educational Demo)

This dashboard is for manual review in the educational simulation. `approved_demo` and `declined_demo` are not real insurance decisions, coverage confirmations, or payment instructions.

## Enable a trusted reviewer

Migration `012_add_admin_claim_review.sql` adds `users.is_admin`, defaulting to `0` for every account. Choose a trusted reviewer account and promote it explicitly in MySQL:

```sql
UPDATE users SET is_admin = 1 WHERE email = '<trusted-reviewer-email>';
```

Verify that exactly one intended account was updated. Do not make ordinary users administrators. The backend checks `is_admin` on every `/api/admin/claims` request; hiding the page in the UI is not the access control.

Apply migrations in order: 012 adds reviewer attribution and notification type; 013 adds evidence review status and notes. Do not run these additive migrations a second time.

## Review flow

1. Sign in as the trusted admin and open **Operations → Claims review**.
2. Filter the queue and open a submitted or under-review claim.
3. Download each ticket/supporting file and mark it `verified` or `needs_correction`; correction notes are required.
4. Add final reviewer notes. Demo approval is enabled only after every evidence file is verified. Declining also requires each file to have a review status.
5. Save `approved_demo` or `declined_demo`. The claimant receives a notification and can see the result on their claim record.

Aviationstack failures and policy terms that are not machine-configured appear for human review. This dashboard does not move money, issue coverage, or guarantee reimbursement.
