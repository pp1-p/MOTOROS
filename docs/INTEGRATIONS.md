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

DealerOS never scrapes Auto Trader.

The integration is optional and requires:

- an authorised Auto Trader Connect agreement;
- a client ID and secret;
- the dealership advertiser ID;
- the actual products and scopes enabled for that agreement;
- webhook/signature documentation applicable to the account.

Environment:

```env
AUTOTRADER_CLIENT_ID=
AUTOTRADER_CLIENT_SECRET=
AUTOTRADER_ADVERTISER_ID=
AUTOTRADER_API_BASE_URL=
AUTOTRADER_WEBHOOK_SECRET=
```

The current adapter distinguishes:

- not configured;
- incomplete/authentication failed;
- configured but unverified;
- permission missing;
- syncing;
- last synced;
- recorded error.

Credentials alone are not represented as a successful connection. The
registration taxonomy adapter deliberately refuses to guess a contract-specific
endpoint. Map it against the authorised Connect documentation during onboarding.

The webhook receiver provides:

- timestamp replay window;
- HMAC verification using the configured secret;
- unique provider/event IDs for idempotency;
- payload recording before processing;
- retry-safe status and error capture;
- limited reserved/sold lifecycle mapping.

Confirm Auto Trader’s exact signature headers and payload schema for the
dealership’s agreement before enabling the endpoint.

Without Auto Trader, staff can still:

- create and update stock manually;
- use DVLA or manual registration entry;
- import/export CSV;
- store manual Auto Trader stock IDs and advert URLs;
- manage reserved and sold states inside DealerOS.

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
