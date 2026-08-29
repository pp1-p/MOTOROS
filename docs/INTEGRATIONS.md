# External integrations

## Vehicle lookup provider contract

All registration lookup is server-side behind:

```ts
interface VehicleLookupProvider {
  lookupByRegistration(registration: string): Promise<VehicleLookupResult>;
}
```

Registrations are normalised, validated and rate-limited. Logs hold a one-way
registration hash rather than the registration itself. Every successful lookup
goes to a staff review screen; lookup data never publishes itself.

### Mock provider

Set `VEHICLE_LOOKUP_PROVIDER=mock`. Explicit fixtures are:

- `DE24 LER`
- `AB12 CDE`
- `XY68 XYZ`

Any other registration returns “not found” and a manual-entry fallback. The
mock provider never manufactures a random vehicle.

### DVLA Vehicle Enquiry Service

Obtain VES access and an API key directly from DVLA, then set:

```env
VEHICLE_LOOKUP_PROVIDER=dvla
DVLA_VES_API_KEY=...
DVLA_VES_BASE_URL=https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles
```

DealerOS maps only fields supplied by VES. VES does not supply the exact model,
derivative, trim, gearbox, body type, doors, seats, equipment or valuation.
Those fields remain subject to licensed enrichment or manual confirmation.

Timeouts, unavailable responses, missing credentials, 404 and 429 responses
produce a visible manual fallback. No provider failure creates invented data.

## Auto Trader Connect

MOTOR.OS never scrapes Auto Trader. This adapter is deliberately locked to the
documented sandbox origin, `https://api-sandbox.autotrader.co.uk`; the base URL
cannot be changed by an environment variable.

### Prerequisites and secure configuration

The dealership must have an authorised Auto Trader Connect sandbox agreement
with the Stock Sync capability and, for writes, the applicable Stock Updates,
Availability Updates, Price Updates and Media Updates capabilities.

Copy `.env.example` to the ignored `.env.local` file and set these variables
locally. Never put their real values in a committed file, ticket, screenshot,
test fixture or log.

```env
AUTOTRADER_API_KEY=replace-with-sandbox-api-key
AUTOTRADER_API_SECRET=replace-with-sandbox-api-secret
AUTOTRADER_ADVERTISER_ID=replace-with-sandbox-advertiser-id
```

For a deployment, add the same names as encrypted server-side environment
variables in the hosting project and redeploy. They must not be prefixed with
`NEXT_PUBLIC_`. An optional Stock Notification endpoint also requires the
separately issued `AUTOTRADER_WEBHOOK_SECRET`.

Credentials being present produces `configured_unverified`, never
`connected`. An owner or staff member with integration-management permission
must open `/admin/integrations` and choose **Verify read access**. This performs
only authentication and `GET /stock` page 1 with a page size of 1. Successful
verification binds the credential set to that dealership using a one-way HMAC
fingerprint. The key, secret and advertiser ID remain environment-only, and a
database uniqueness guard prevents another MOTOR.OS tenant from claiming the
same credential set.

### Stock mapping and lifecycle policy

The local vehicle UUID is sent as `metadata.externalStockId`, making it the
stable idempotency key. MOTOR.OS first downloads the complete sandbox baseline
and matches by saved `stockId`, local UUID, then a unique registration or VIN.
A documented `409` duplicate response is resolved using its existing
`stockId`; the create request is never repeated automatically.

Only Auto Trader channel states `ready`, `published`, `paused` and `removed`
participate:

| MOTOR.OS state | Sandbox effect |
| --- | --- |
| `ready` | Create or update stock with the Auto Trader advert `NOT_PUBLISHED` |
| `published` | Create or update and explicitly request `PUBLISHED` |
| `paused` | Set only the Auto Trader advert to `NOT_PUBLISHED` |
| local `sold` | Unpublish all five retail destinations, then set `SOLD` |
| removed, returned, archived or soft-deleted | Unpublish all five destinations, then set `WASTEBIN` |

MOTOR.OS never automatically sends `DELETED`. New records default to
unpublished unless the channel explicitly says `published`. Invalid vehicles
are skipped individually so one bad stock record does not stop the batch.
Authentication, permission, exhausted rate-limit and provider-availability
errors halt the advertiser batch predictably.

The current model syncs registered cars. New unregistered stock is skipped
rather than guessed. Existing image URLs are not sent because the Stock API
requires image IDs created through the Auto Trader Images API. YouTube and
Vimeo video URLs are supported. A derivative ID can be stored in the vehicle's
Auto Trader channel; stock without one is allowed with a warning because its
specification, valuation and price indicator may be incomplete.

### Running a sync

Full stock sync:

1. Open `/admin/integrations`.
2. Select **Verify read access**.
3. Select **Preview**. This performs GET requests only.
4. Review the created, updated, unchanged, skipped and failed totals and every
   internal stock number/UUID/effect.
5. Select **Apply preview to sandbox** and approve the confirmation that names
   the exact records. This is the first step that can write sandbox stock.

Single vehicle sync:

1. Open the vehicle and choose **Sales channels**.
2. Save its Auto Trader channel as `ready`, `published`, `paused` or `removed`.
3. Use the vehicle's **Preview**, review its one-record result, then select
   **Apply preview to sandbox**.

The sync is operator-controlled and is not scheduled automatically. This
prevents an unreviewed channel-state change from publishing or withdrawing
stock. Every applied record writes a `vehicle_sync_records` audit row and a
secret-safe outcome.

### Retries, limits and troubleshooting

Requests time out after 15 seconds. GET and field-setting PATCH operations use
at most three attempts. A `429` waits at least one second; `503`/`504` waits at
least two seconds, with bounded exponential backoff. POST stock creation is
never retried automatically because an interrupted create may already have
succeeded.

- **Configuration incomplete:** set all three required names in `.env.local`
  or the hosting environment, then restart/redeploy. Do not paste the values
  into chat or a tracked file.
- **401 authentication:** confirm the sandbox key and secret belong together
  and have not expired or been rotated.
- **403 permission missing:** stop sync and ask Auto Trader to confirm the
  advertiser and required service capabilities. Repeating the request will not
  grant access.
- **400 validation:** fix the named local record. Check registration, make,
  model, vehicle type, derivative length, advert text and the minimum £75
  price. The rest of the batch continues.
- **409 duplicate:** MOTOR.OS reads the returned stock ID and updates that
  record; it does not create a second advert.
- **429 rate limit:** the client pauses and retries within its fixed attempt
  limit. If it remains exhausted, the batch halts and can be previewed later.
- **503/504 server error or timeout:** wait and preview again. Give Auto Trader
  support the recorded `CF-RAY` request identifier if one is available; it is
  safe diagnostic metadata, not a credential.

Stock Notifications use HTTPS `PUT` at
`https://YOUR_DOMAIN/api/webhooks/autotrader` and the documented
`AutoTrader-Signature: t=...,v1=...` header. MOTOR.OS verifies HMAC-SHA256 over
`timestamp.rawBody`, rejects stale deliveries, records each stock ID/time pair
idempotently and ignores notifications older than the last processed event.

Without Auto Trader, staff can still create and update stock manually, use
DVLA or manual registration entry, store manual stock IDs and manage reserved
and sold states inside MOTOR.OS.

## Email

`EMAIL_PROVIDER=console` records a redacted structured event and leaves the
in-app notification as the reliable fallback.

For Resend:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=
EMAIL_FROM="Dealership <sales@example.co.uk>"
```

Verify the sending domain and test delivery, bounce and suppression handling
before launch.

## SMS

No SMS delivery adapter is implemented in this release, and DealerOS never
labels SMS as configured or sends a message. Core workflows continue through
database records, in-app notifications and optional email. If SMS is required,
add an approved provider adapter, consent controls, templates, delivery-status
handling and end-to-end tests before exposing that option to customers.
