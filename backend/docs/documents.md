# Documents and Notifications

Documents are stored in the configured private `EVIDENCE_STORAGE_DIR`; this directory must not be inside a public/static folder. Upload validation checks the file signature and accepts PDF, JPEG, or PNG up to 10 MB. OCR is not performed.

## Migrations

Apply migrations 010 and 011 after claims, evidence, billing, and policies migrations:

```powershell
mysql -u <user> -p travelshield < backend\sql\010_add_documents_notifications.sql
mysql -u <user> -p travelshield < backend\sql\011_add_invoice_due_dates.sql
```

Migration 010 adds owner-linked generated/user-uploaded document metadata and notifications. Migration 011 adds invoice due dates and the `REFUNDED` payment state. Generated invoice PDFs are stored privately when an invoice is created. A demo-paid invoice generates a simulated policy certificate and insurance card. Existing claim evidence is listed from its original claim-owned records.

## Routes

All routes require bearer authentication and filter by the signed-in user:

- `GET /api/documents?category=all|policy|claim|uploaded` lists owned documents. Invoice documents are surfaced in Billing & Invoices, not in the Documents page.
- `POST /api/documents` accepts multipart fields `document` (PDF/JPG/PNG), `document_type`, and optional `policy_id` or `claim_id`.
- `GET /api/documents/:source/:documentId/download` downloads an owned file. `source` is `stored` or `claim`.
- `DELETE /api/documents/:documentId` deletes only user-uploaded files; generated policy and invoice files and claim evidence cannot be deleted here.
- `GET /api/notifications` lists notifications and unread count.
- `PATCH /api/notifications/:notificationId/read` marks an owned notification read.
- `GET /api/billing/invoices/:invoiceId/download` downloads the invoice PDF only for its owner.

Uploads, claim evidence, invoice creation, demo payment changes, and simulated policy activation create owner-scoped notifications. No synthetic paid invoices, claim documents, or policy certificates are seeded for arbitrary users; generated records appear from their own demo actions.

Billing remains an educational simulation. `PAID` demo outcomes are not real payment confirmations; production payment status must come from a verified payment-provider webhook or server-side provider check.
