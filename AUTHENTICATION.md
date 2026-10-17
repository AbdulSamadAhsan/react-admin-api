> Current dashboard integration: product, order, customer, and settings routes are open without authentication or authorization. The admin subsystem is retained separately. See `DASHBOARD.md`.

# Admin API

The API follows the existing model/controller/route structure:

- `models/AdminModel.js`: admin accounts and password hash storage.
- `controllers/AdminController.js`: register, login, and current account.
- `routes/AdminRoute.js`: `/api/admin` endpoints.
- `middlewares/auth.js`: bearer-token authentication and current-account role checks.
- `services/AdminService.js`: JWT signing, setup-key verification, and shared login limits.
- `models/AuthAttemptModel.js`: Mongo-backed counters shared across serverless instances.

## Server configuration

Set two independent, random secrets, each at least 32 bytes:

- `JWT_SECRET`: signs one-hour HS256 access tokens.
- `ADMIN_REGISTRATION_KEY`: authorizes creation of admin accounts.

Local secrets have been added to the ignored `.env` file. Do not commit them or put them in frontend code. `.env.local` takes precedence when present. Configure both values in the Vercel deployment environment before deploying authentication. Removing `ADMIN_REGISTRATION_KEY` disables registration without affecting existing logins.

## Register an admin

Send `POST /api/admin/register` with `Content-Type: application/json` and the header `X-Admin-Registration-Key: <server setup key>`. Use a trusted server or API client for this operation; do not distribute the setup key with a public registration form.

```json
{
  "name": "Store Administrator",
  "email": "admin@example.com",
  "password": "replace with your own long unique password"
}
```

Names must be 1–100 characters. Passwords must be at least 15 characters and at most 72 UTF-8 bytes (the bcrypt input limit). Email addresses are normalized to lowercase and must be unique. Caller-provided `role` and `active` values are ignored; authorized registration creates an active admin. Password hashes are never returned.

Success returns HTTP 201 with `admin`, `token`, `tokenType: "Bearer"`, and `expiresIn: 3600`. Duplicate emails return 409, invalid fields return 400, and missing/invalid setup keys return 403.

## Login

Send `POST /api/admin/login` with `Content-Type: application/json`:

```json
{
  "email": "admin@example.com",
  "password": "your password"
}
```

Success returns HTTP 200 with the same account/token fields. Unknown accounts, incorrect passwords, disabled accounts, and non-admin accounts receive the same 401 response. Login permits 10 attempts per normalized email per 15-minute window; authorized registration permits 20 attempts per 15-minute window. Excess attempts return 429 and `Retry-After: 900`. Mongo TTL cleanup removes expired counters; the window is enforced even before cleanup runs.

## Protected requests

Send `Authorization: Bearer <token>` with:

- `GET /api/admin/me`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

For product uploads continue using multipart form-data with the `image` field. Authentication runs before upload processing. The root health endpoint and public image URLs remain public. All product API endpoints require an active admin account, including listing.

Missing, invalid, or expired tokens return 401. A valid token for a non-admin account returns 403. Missing authentication configuration or unavailable MongoDB returns 503. Roles and active status are read from MongoDB on every request, so disabling or deleting an account immediately prevents access with its existing token.

The frontend must implement login and send the bearer token on product requests before this change is deployed. A token expires after one hour; log in again to obtain a new one. There is no refresh-token or server-side logout endpoint. Client logout clears the token; disabling the account revokes access for all of its tokens.

## Verification

Run `npm test`. The tests use real password hashing, JWT signing/verification, and HTTP requests with mocked database calls. Storage lifecycle tests isolate authentication; `tests/auth.test.js` tests the real guards. No live admin accounts or production products are created by these tests.

Security references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
