## Whish API Sandbox Documentation (Tested)

Date tested: 2025-08-12

- Base URL (Testing): `https://lb.sandbox.whish.money/itel-service/api/`
- Required headers (all requests):
  - `Content-Type: application/json`
  - `channel: 10196115`
  - `secret: 80af9650b74c4c209e0e0daa5d7d331e`
  - `websiteurl: fleetapp.me`

Notes observed during testing:
- The API typically returns HTTP 200 even for application-level errors. Use the JSON envelope to determine success/failure.
- JSON envelope fields seen across endpoints: `status` (boolean), `code` (string|null), `dialog` (object|null), `actions` (null in tests), `extra` (null in tests), `data` (object|null).
- Currency accepted per spec: `LBP`, `USD` (and possibly `AED` for payment). Rate endpoint is currently deactivated.
- Callback behavior (sandbox): callbacks are issued as HTTP GET requests with no body by default. Include your own correlation parameters in the callback URL query string.

### Common response envelope

Success (example):

```json
{
  "status": true,
  "code": null,
  "dialog": null,
  "actions": null,
  "extra": null,
  "data": { /* endpoint-specific */ }
}
```

Failure (examples):

```json
{
  "status": false,
  "code": "400",
  "dialog": {
    "title": "Error",
    "message": "Mandatory parameters are missing",
    "yesButton": null,
    "noButton": null
  },
  "actions": null,
  "extra": null,
  "data": null
}
```

```json
{
  "status": false,
  "code": "auth.session_not_exist",
  "dialog": {
    "title": "Error",
    "message": "Please sign in again. You have been signed out.",
    "yesButton": null,
    "noButton": null
  },
  "actions": null,
  "extra": null
}
```

```json
{
  "status": false,
  "code": "external_id.not_exists",
  "dialog": null,
  "actions": null,
  "extra": null,
  "data": null
}
```

---

## Endpoints

### 1) Get Balance

- Method: `GET`
- Path: `/payment/account/balance`
- Request body: none
- Required headers: as listed above

Observed success response (with provided credentials):

```json
{
  "status": true,
  "code": null,
  "dialog": null,
  "actions": null,
  "extra": null,
  "data": {
    "balance": 0.0
  }
}
```

Observed error (missing required headers):

```json
{
  "status": false,
  "code": "400",
  "dialog": {
    "title": "Error",
    "message": "Mandatory parameters are missing",
    "yesButton": null,
    "noButton": null
  },
  "actions": null,
  "extra": null,
  "data": null
}
```

Curl example:

```bash
curl -s -X GET "https://lb.sandbox.whish.money/itel-service/api/payment/account/balance" \
  -H "Content-Type: application/json" \
  -H "channel: 10196115" \
  -H "secret: 80af9650b74c4c209e0e0daa5d7d331e" \
  -H "websiteurl: fleetapp.me"
```

---

### 2) Get Rate (Deactivated)

- Method: `POST`
- Path: `/payment/whish/rate`
- Body: `{ "amount": number, "currency": "USD"|"LBP" }`

Observed behavior (sandbox): Returns HTTP 404 (HTML) indicating the endpoint is not available. Treat as deactivated for now.

```html
HTTP Status 404 – Not Found
```

---

### 3) Whish Pay (Create Payment)

- Method: `POST`
- Path: `/payment/whish`
- Required headers: as listed above
- Body (example used in tests):

```json
{
  "amount": 100,
  "currency": "USD",
  "invoice": "Test payment via sandbox",
  "externalId": 20250812115001,
  "successCallbackUrl": "https://webhook.site/6a35123c-0294-4325-9454-c07cfdf1a0bf?eid=20250812115001&dealerId=DEALER123&plan=monthly",
  "failureCallbackUrl": "https://webhook.site/074b1018-cb5c-42da-833e-716d53a3061e?eid=20250812115001&dealerId=DEALER123&plan=monthly",
  "successRedirectUrl": "https://fleetapp.me/success",
  "failureRedirectUrl": "https://fleetapp.me/failure"
}
```

Observed success response:

```json
{
  "status": true,
  "code": null,
  "dialog": null,
  "actions": null,
  "extra": null,
  "data": {
    "collectUrl": "https://ae.sandbox.whish.money/itel-service/shorten/RfKgjD3"
  }
}
```

Notes:
- Opening `collectUrl` presents the payment page. For sandbox testing:
  - Success path: use phone `96170902894` with OTP `111111`.
  - Failure path: use any phone with an OTP other than `111111`.
  - In sandbox, OTPs are not actually delivered.
- `externalId` must be numeric (Long). Avoid UUIDs; using a UUID will result in `external_id.not_exists` on status checks.

Potential errors:
- Invalid/missing headers: see the "Mandatory parameters are missing" example under Get Balance.
- Invalid credentials: may return `code: "auth.session_not_exist"` with an error dialog.

Curl example:

```bash
curl -s -X POST "https://lb.sandbox.whish.money/itel-service/api/payment/whish" \
  -H "Content-Type: application/json" \
  -H "channel: 10196115" \
  -H "secret: 80af9650b74c4c209e0e0daa5d7d331e" \
  -H "websiteurl: fleetapp.me" \
  -d '{
    "amount": 100,
    "currency": "USD",
    "invoice": "Test payment via sandbox",
    "externalId": 20250812115001,
    "successCallbackUrl": "https://webhook.site/6a35123c-0294-4325-9454-c07cfdf1a0bf?eid=20250812115001&dealerId=DEALER123&plan=monthly",
    "failureCallbackUrl": "https://webhook.site/074b1018-cb5c-42da-833e-716d53a3061e?eid=20250812115001&dealerId=DEALER123&plan=monthly",
    "successRedirectUrl": "https://fleetapp.me/success",
    "failureRedirectUrl": "https://fleetapp.me/failure"
  }'
```

---

### 4) Get Status (Payment Collect Status)

- Method: `POST`
- Path: `/payment/collect/status`
- Required headers: as listed above
- Body:

```json
{
  "currency": "USD",
  "externalId": 20250812115001
}
```

Observed success response (for the created payment before completion):

```json
{
  "status": true,
  "code": null,
  "dialog": null,
  "actions": null,
  "extra": null,
  "data": {
    "collectStatus": "pending"
  }
}
```

Observed error (unknown `externalId`):

```json
{
  "status": false,
  "code": "external_id.not_exists",
  "dialog": null,
  "actions": null,
  "extra": null,
  "data": null
}
```

Possible values for `data.collectStatus` (per spec and expected behavior): `success`, `failed`, `pending`.

Curl example:

```bash
curl -s -X POST "https://lb.sandbox.whish.money/itel-service/api/payment/collect/status" \
  -H "Content-Type: application/json" \
  -H "channel: 10196115" \
  -H "secret: 80af9650b74c4c209e0e0daa5d7d331e" \
  -H "websiteurl: fleetapp.me" \
  -d '{
    "currency": "USD",
    "externalId": 20250812115001
  }'
```

---

## Callbacks (success/failure)

- Fields in payment request: `successCallbackUrl` and `failureCallbackUrl`.
- For testing, we used webhook endpoints: [`success`](https://webhook.site/6a35123c-0294-4325-9454-c07cfdf1a0bf) and [`failure`](https://webhook.site/074b1018-cb5c-42da-833e-716d53a3061e).
- Observed behavior (sandbox):
  - HTTP method: GET
  - Body: empty (content-length: 0)
  - Default query params: none (unless you add them yourself)
  - Typical headers include `User-Agent: Apache-HttpClient/4.5.13` and `Accept-Encoding: gzip,deflate`.

Recommended to include correlation params in your callback URLs when creating the payment:

```text
?eid=<externalId>&dealerId=<dealerId>&plan=<monthly|yearly>&state=<opaque>&sig=<HMAC>
```

Server-side (Edge Function) should:
- Validate `sig` (HMAC over the canonical query) to prevent tampering
- Look up the pending transaction by `eid`, verify dealer/plan/amount match your stored record
- Call `POST /payment/collect/status` with the same `externalId` and `currency` to confirm `collectStatus`
- Update state only if status is `success`
- Make the operation idempotent by externalId

---

## Implementation Tips

- Treat any `status: false` as failure even if HTTP status is 200; branch on `code`.
- Recommended flow:
  1) Create payment → store `externalId` you generated.
  2) Redirect/open `collectUrl` and let user complete the flow.
  3) On callback: validate signature and query, then call status endpoint by `externalId` and finalize only if `success`.
  4) Optionally poll `/payment/collect/status` until terminal state (success/failed) if no callback received.
- Ensure `Content-Type: application/json` and all three headers are present on every request.

---

## Change Log

- 2025-08-12: Verified sandbox behavior. Balance returns `data.balance` (not `balanceDetails.balance`). Rate endpoint returns 404 (deactivated). Payment returns `data.collectUrl`. Status returns `data.collectStatus` and `external_id.not_exists` for unknown IDs.
- 2025-08-13: Documented sandbox callback behavior (GET, empty body). Updated guidance to append `eid`, `dealerId`, `plan` (and optional `sig`, `state`) to callback URLs and to verify via status.


