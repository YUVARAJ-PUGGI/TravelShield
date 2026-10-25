# Educational Billing Demo

Billing in this repository is simulated only. There is no payment gateway, real charge, insurer integration, or real policy activation. The demo payment endpoint is not suitable for production payment confirmation.

## Pricing and invoices

A saved quote is recalculated from the active plan's configured `base_daily_rate`, inclusive trip duration, and traveller count. Invoice tax and fixed fees are controlled by optional backend environment variables:

```env
BILLING_TAX_RATE=0
BILLING_FIXED_FEE=0
```

Tax is a percentage. Defaults are zero because no tax jurisdiction or fee schedule is configured. Configure these only with the correct rules for your jurisdiction and use case.

## Migration

Apply the billing migration after policies and quotes exist:

```powershell
mysql -u <user> -p travelshield < backend\sql\009_add_billing.sql
```

The migration adds `simulated_pending_payment` to policy status and creates `billing_invoices`. Existing policy rows retain their current status; existing records are not marked paid or backfilled with fabricated invoices.

## Endpoints

All billing routes require the existing bearer authentication middleware.

- `POST /api/billing/invoices` with `{ "quote_id": 1 }` recalculates the quote premium, creates a pending simulated policy, and creates a `PENDING` invoice.
- `GET /api/billing/invoices` returns invoices belonging to the signed-in user.
- `POST /api/billing/invoices/:invoiceId/demo-payment` with `{ "outcome": "PAID" }` or `{ "outcome": "FAILED" }` records a demo outcome. Only `PAID` changes a pending simulated policy to `simulated_issued`; `FAILED` leaves it inactive. This endpoint does not verify or process a real payment.
- `POST /api/policies/issue` is disabled so direct policy issuance cannot bypass billing.

For a real payment integration, replace the demo endpoint with a provider checkout and verify signed provider webhooks or query the provider server-to-server before recording `PAID` and activating a policy. Never trust a client-submitted payment-success flag.
