# Educational policy simulation API

The policy API is an explicit educational simulation. A saved quote remains a
quote until the signed-in user requests issuance. These endpoints do not create
real insurance, process payment, or prove coverage.

## Apply the migration safely

1. Back up `travelshield_db` using the existing MySQL backup procedure before
   applying a schema change. Do not overwrite the local `travelshield_backup.sql`.
2. Review `backend/sql/004_create_policies.sql`.
3. Apply it from the repository root with MySQL:

   ```powershell
   mysql -u <user> -p travelshield_db < backend\sql\004_create_policies.sql
   ```

4. Verify the table and constraints before using the API:

   ```sql
   SHOW CREATE TABLE policies;
   SELECT COUNT(*) FROM quotes;
   SELECT COUNT(*) FROM policies;
   ```

The migration is additive and uses `CREATE TABLE IF NOT EXISTS`; it does not
modify existing users, quotes, plans, countries, or coverage rules.

## Endpoints

All endpoints require `Authorization: Bearer <token>`.

- `GET /api/policies` — list only the authenticated user's simulated policies.
- `GET /api/policies/:policyId` — retrieve one simulated policy owned by the
  authenticated user.
- `POST /api/policies/issue` with `{ "quote_id": 123 }` — explicitly issue one
  simulated policy from an owned, generated quote. The database transaction and
  unique `quote_id` constraint prevent duplicate issuance.
