# tandem.flights – Vendure backend

Replaces the voucher shop of the old TYPO3 site (`typo3conf/ext/ext_shop`). It is based on the hantha
`shop-template-vendure` (the sshoptest.it copy, Vendure 3.7.4), with these changes on top:

| Where | What |
| --- | --- |
| `src/plugins/tandem-plugin/` | new plugin: shop-api `checkVoucher`, checkout rules (country, tax number for Italy), Order custom field `comment` |
| `src/vendure-config.ts` | default language `de`, PayPal + Stripe only, `HtPlugin.init({ registerManualPaymentHandlers: false })`, sender "Tandem Flights Sarntal" <info@tandem.flights>, SMTP only from env incl. STARTTLS (the template's hard-coded SMTP login is removed), CORS origins (`CORS_ORIGINS`) |
| `src/plugins/ht-plugin/entities/order/shop-order.resolver.ts` + `constants.ts` | `SHOP_VOUCHER_REDEEM_ONLINE=false` → `applyCouponCode` rejects vouchers ("nur vor Ort einlösbar") |
| `Dockerfile` | yarn cache mount (as arundavivaldi.it_vendure) |
| `src/populate.ts` | countries/zones/taxes for tandem (22 % / 10 % / 0 %), no demo products |
| `src/plugins/ht-plugin/ht.plugin.ts` | option `registerManualPaymentHandlers` (default true, template behaviour unchanged) |
| `src/plugins/ht-plugin/entities/voucher/service.ts` | `SHOP_VOUCHER_CODE_LENGTH` → random `[0-9A-Z]` codes of that length (unset = template behaviour) |
| `src/plugins/ht-plugin/services/voucher-by-order-service.ts` | extra PDF inputs `code`, `qrCode` (`SHOP_VOUCHER_QR_URL` + code), `subtitle` (product short description); every template text field whose name matches a textblock is filled with that textblock in the voucher language |
| `src/plugins/ht-plugin/handler/order-confirmation.ts` | textblock `orderVoucherText` for PayPal/Stripe orders |
| `src/plugins/ht-plugin/dashboard/pages/voucher-detail.tsx` | button "Vor Ort eingelöst" (sets the balance to 0) |
| `scripts/tandem-import/` | seed + import scripts, voucher PDF template, assets |

## Git

Repository: https://github.com/martinhantha/tandem.flights_vendure (branches `develop` and `master`).
The template's plugins (custom-attributes `c9698b4`, hantha-importer `8795941`, paypal-payment `99f1d9a`) are
vendored as plain folders, so Coolify can build without access to other repos. There are no git submodules.

`deploy.config.json` points to repo `martinhantha/tandem.flights_vendure`; add the Coolify webhook URL once the app exists.

## Deployment (Coolify on avelom.cloud, Docker Compose)

Public URL **https://ecommerce.tandem.flights** – shop-api `https://ecommerce.tandem.flights/shop-api`, admin-api
`/admin-api`, dashboard `/dashboard`, assets `/assets/…`, Stripe webhook `/payments/stripe`.
`compose.yml` / `compose-base.yml` are identical to the reference project arundavivaldi.it_vendure.

1. **Base resource** (once per server/project): Coolify → New Resource → Docker Compose from the git repo, compose file
   `compose-base.yml` (Postgres `database`, `elasticsearch`, nightly `backup`, `loki`). Requires the external networks
   `coolify` and `log-drains_default` (created by Coolify / the logging-drain setup, see `compose.logging-drain.yml` and
   `observability/README.md`). Env: `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `AWS_*` (backup upload).
   Note: the container names `database` / `elasticsearch` are fixed – one shop stack per Docker host/network, as in the reference projects.
2. **App resource**: New Resource → Docker Compose, same repo, branch `master` (prod) / `develop` (dev), compose file `compose.yml`
   (`server_base` builds the image, `server` on port 4000, `worker` with health check on 3020).
3. Domain: on service `server` set `https://ecommerce.tandem.flights:4000` (Coolify/Traefik routes the domain to port 4000, Let's Encrypt).
   DNS: `ecommerce.tandem.flights` A/AAAA → avelom.cloud server.
4. Environment variables (Coolify UI, "Environment Variables"): all keys of `.env.example` with production values –
   `APP_ENV=prod`, `APP_LOCAL=false`, `PORT=4000`, `APP_URL_PROD=https://ecommerce.tandem.flights`, `DB_HOST=database`,
   `CORS_ORIGINS`, SMTP, PayPal, Stripe, `AWS_*`, `SHOP_*`. Coolify writes them as `.env` into the build context; the app
   reads it via `dotenv/config` (same as the reference projects – `.env` is not in `.dockerignore`, but in `.gitignore`).
5. Deploy. First deploy on an empty DB: in the `server` container terminal run `yarn populate`, `yarn tandem:seed`
   and the imports (copy the dump into the container temporarily with `docker cp`, delete it afterwards).
6. Stripe: create the webhook endpoint `https://ecommerce.tandem.flights/payments/stripe` (event `payment_intent.succeeded`,
   `payment_intent.payment_failed`), put the signing secret into `STRIPE_WEBHOOK_SECRET`, then `yarn tandem:seed --update-payment`.
7. Optional: `yarn deploy` (deploy.js / `DEPLOY_SCRIPT_HOME`) once `deploy.config.json` has the Coolify webhook URL.

CORS: `CORS_ORIGINS` (default `https://www.tandem.flights, https://tandem.flights, https://cms.tandem.flights` (TYPO3 ShopSelectOptions),
`http://localhost:3000`, `http://localhost:3001`). The dashboard runs on the backend host itself.

## Setup (local)

```
cp .env.example .env            # fill in, see below
yarn install
# Postgres + Elasticsearch (template standard: ES on localhost:9201 when APP_LOCAL=true)
yarn populate                   # countries, zones, tax rates (empty DB only)
yarn tandem:seed                # channel, languages, shipping, payment methods, textblocks, voucher template, PDF font
yarn tandem:import-products --dump /path/to/tandema_db0.sql
yarn tandem:import-vouchers --dump /path/to/tandema_db0.sql
yarn devlocal                   # or yarn dev
```

`yarn tandem:typecheck` checks `src` and the scripts. `yarn build` builds server + dashboard.

### Env keys

All keys are listed in `.env.example` (empty values). Required for production:
`APP_ENV, APP_URL_PROD, COOKIE_SECRET, FIELD_ENCRYPTION_KEY, SUPERADMIN_USERNAME/PASSWORD, DB_*`,
`SHOP_URL_PROD=https://www.tandem.flights, SHOP_NAME, SHOP_EMAIL=info@tandem.flights`,
`SHOP_VOUCHER_CODE_LENGTH=8, SHOP_VOUCHER_QR_URL=https://tandem.flights/qr?key=, SHOP_VOUCHER_REDEEM_ONLINE=false`,
`SMTP_HOST/PORT/SECURE/REQUIRE_TLS/USER/PASSWORD`, `CORS_ORIGINS`, `PAYPAL_CLIENT_ID/SECRET/MODE`, `STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET`
(`STRIPE_PUBLISHABLE_KEY` is for Nuxt), `AWS_*` (S3 asset storage).

PayPal/Stripe credentials are stored in the payment methods (DB). `yarn tandem:seed` creates them from env; after
changing the env run `yarn tandem:seed --update-payment`, or edit them in the dashboard. A method without credentials
is created disabled (with placeholder args).

### E-mail (Aruba)

Mailbox info@tandem.flights at Aruba: `SMTP_HOST=smtps.aruba.it`, `SMTP_PORT=587`, `SMTP_SECURE=false` (connect plain,
then STARTTLS), `SMTP_REQUIRE_TLS=true` (abort if STARTTLS is not offered), `SMTP_USER=info@tandem.flights`,
`SMTP_PASSWORD` = mailbox password. Without `SMTP_SECURE` the transport uses implicit TLS only on port 465.
Order confirmations go to the customer with a copy to info@tandem.flights.

### PayPal REST app (needed, the old shop only used the business e-mail)

The old shop used PayPal Website Payments Standard (only the business e-mail address, no API keys). The Vendure plugin
uses the PayPal REST API (Orders v2), so a REST app is needed for the **existing** business account:

1. Log in at https://developer.paypal.com with the tandem.flights PayPal business login.
2. Apps & Credentials → switch to **Live** → Create App (type "Merchant", name e.g. "tandem.flights shop").
3. Copy **Client ID** and **Secret** into `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET`, set `PAYPAL_MODE=live`.
   (For tests: same in the **Sandbox** tab with a sandbox business + buyer account, `PAYPAL_MODE=sandbox`.)
4. Make sure the app has the "Accept payments" feature (default). No webhook is needed – the plugin captures the order on return.
5. `yarn tandem:seed --update-payment` (or enter the values in Dashboard → Settings → Payment methods → paypal) – the method is enabled once both values are set.

### Seed flags

- `--force-texts` overwrite the textblocks with the defaults from `scripts/tandem-import/voucher-template/textblocks.ts`
- `--force-template` overwrite the `voucher-template` (pdfme) with `scripts/tandem-import/voucher-template/tandem-voucher-template.json`
- `--update-payment` write the PayPal/Stripe credentials from env into the existing payment methods

## Taxes (confirmed)

Gross prices incl. Italian VAT 22 % for every customer (service performed in Italy): all zones get Standard 22 % /
Reduced 10 % / Zero 0 %, the channel's default tax zone is "Europe", `pricesIncludeTax = true`, products use "Standard Tax" (22 %).

## Imports

The dump contains personal data (customers, orders, coupon recipients). Keep it outside the repo, pass it with
`--dump` or `TANDEM_SQL_DUMP`. The scripts print counts only. `--dry-run` parses the dump without touching the DB.

### Products (`yarn tandem:import-products`)

hantha-importer pattern (Asset/Product/TaxCategory/ProductVariant importer services, as `src/importer.ts` in
arundavivaldi). Idempotent (products matched by slug de, variants by sku).

| sku | old uid | name | price | enabled |
| --- | --- | --- | --- | --- |
| td001 | 2 | Easy Flight | 140 € | yes |
| td002 | 1 | Winter Flight | 150 € | yes |
| td003 | 3 | Eagle Flight | 180 € | yes |
| td004 | 10 | Hike and Fly | 300 € | yes |
| td005 | 13 | Breakfast Flight | 170 € | yes |
| td005b | 16 | 1 Eagle flight + 2 x Marende | 170 € | no (old sku td005 was duplicate) |
| td007 | 19 | Easy Flight mit 2 Frühstück in der Panoramic Lotsch | 180 € | no |

- Name split: "für Einsteiger und Genießer - Easy flight" → name "Easy Flight", `customFields.shortDescription`
  "für Einsteiger und Genießer" (per language; the en name of td001 has no " - …" so the whole text becomes the short description).
  The two hidden products have no tagline; their it/en rows were copies of other products, so the German name is used everywhere.
- Description = old `description` HTML. `isDigital = true` (product), `isVoucher = true` (variant), no stock tracking.
- The importer's default variant *update* mapper takes "140" as 140 cents; the script fixes this with a custom update mapper.
- **Title images are not in the local TYPO3 copy.** Put them into `scripts/tandem-import/assets/products/` with these
  names (the dry-run lists them), then re-run the import:
  `reinswald-tandemfliegen.jpg` (Reinswald_Tandemfliegen.jpg), `tandemfliegen-in-sudtirol.jpg` (Tandemfliegen_in_Südtirol.jpg),
  `tandemflug-reinswald.jpg` (Tandemflug_Reinswald.JPG), `tandemflug-in-suedtirol-bozen-sarntal-1.jpg`, `tandemflug-in-suedtirol-bozen-sarntal-2.jpg`
  (originals in `fileadmin/user_upload/` of the live site).

### Vouchers (`yarn tandem:import-vouchers`)

Dry-run result on `tandema_db0.sql`: 543 coupons, 96 deleted (skipped) → **447 imported**: 182 used, 35 unused and
still valid, 230 unused and expired; 63 linked to a shop product; 421 with a known value, 26 without (e.g. "Gratis").

Mapping onto the ht-plugin `Voucher` entity:

- `code` = `couponid` exactly as printed (existing codes are skipped → idempotent)
- `initialAmount` = first number of the free-text price ("110 €" → 11000) or, if empty, the price of the product
  (`productid` = old product `id`: 1=td001 140, 2=td002 150, 3=td003 180, 4=td004 300, 5=td005 170, 7=td007 180);
  no number → `null`
- `amount` = 0 if `used`, else `initialAmount` (null = value unknown, counts as not used)
- `validFrom` = `crdate`, `validTo` = `expiredate`, `currencyCode` = EUR
- `product_id` = Vendure variant id of the sku (shop vouchers only)
- `info` = "Import TYPO3 | Empfänger/Info … | Ausgestellt von … | Preis (alt) … | Bestellung (alt) …" (personal data, DB/dashboard only)
- Old orders (`tx_extshop_domain_model_cart`) are not imported. The old order id is only kept in `info`.
- Note: old product id 3 is used by both "Eagle flight" (uid 3, 180 €) and the hidden "Eagle + 2 x Marende" (uid 16, 170 €); mapped to td003.

## Voucher PDF

pdfme template `scripts/tandem-import/voucher-template/tandem-voucher-template.json` (images referenced as
`asset:voucher/…`, inlined as base64 by the seed), stored as CustomSettings `voucher-template` and editable in the dashboard
(Gutscheine → PDF Designer). Layout as `Pdfcreator.php`: logo top left, QR (`https://tandem.flights/qr?key=CODE`) top right
with the code below, hero image, watermark, "Gutschein / für einen Tandemflug!", product name + short description,
Leonardo da Vinci quote, contact text with phone, address, "Gültig bis: DD.MM.YYYY". Validity 1 year (ht-plugin default).

Texts are language-aware through textblocks with the field names (`voucherHeadline, voucherSubline, voucherQuote,
voucherQuoteAuthor, voucherContactText`, plus the ht-plugin keys `voucherAddressText, voucherDatePrefixText, voucherDateFormat`),
translated from the old `locallang.xlf` files (it typo "terraguardando" fixed; the old en contact text was German, the English one from `locallang.xlf` is used).
The language is the order's `languageCode`. Sample render without DB:
`npx ts-node scripts/tandem-import/render-voucher-sample.ts` (writes `scripts/tandem-import/out/`, gitignored).

Limitations: only the `Roboto` regular font is available (pdf-helper / PDF designer), so the headline is not bold as in the old PDF.
The font must exist in asset storage at `assets/fonts/roboto-regular.ttf` – `yarn tandem:seed` uploads it.
Vouchers are generated (and attached to the order confirmation) only for orders in state `PaymentSettled`; a PayPal payment
that stays "Authorized" gets no PDF until the dashboard action "ckeckAndCreateVoucherPdf"/resend is used.
Vouchers created by hand in the dashboard have no PDF (the old "generatecoupon" backend form has no equivalent yet).

## For the Nuxt frontend

- Shop API: `<APP_URL>/shop-api` (e.g. `https://<backend-domain>/shop-api`), language via `?languageCode=de|it|en`,
  auth via `vendure-auth-token` bearer header (tokenMethod bearer + cookie). Currency EUR, prices incl. tax (`priceWithTax`).
- Products: 5 enabled products, one variant each (`td001`–`td005`), `customFields.shortDescription`, `variant.customFields.isVoucher`.

### Checkout

1. `addItemToOrder(productVariantId, quantity)`
2. `setCustomerForOrder(input: { firstName*, lastName*, emailAddress* })`
3. `setOrderBillingAddress(input: { fullName, streetLine1: "", countryCode*, customFields: { taxnumber } })` –
   `streetLine1` is required by Vendure but not asked by the shop (send `""`); `taxnumber` (codice fiscale or P.IVA) is required when `countryCode = "IT"`.
4. `setOrderCustomFields(input: { customFields: { comment } })` (optional, max 2000 chars)
5. `eligibleShippingMethods` → `setOrderShippingMethod(shippingMethodId: [<id of code "digital">])` (free)
6. `transitionOrderToState(state: "ArrangingPayment")` – on invalid data returns `OrderStateTransitionError` with
   `transitionError` = comma separated codes: `CUSTOMER_NAME_REQUIRED`, `COUNTRY_REQUIRED`, `TAX_NUMBER_REQUIRED`, `TAX_NUMBER_INVALID`,
   `VOUCHER_ONLINE_REDEMPTION_DISABLED` (safety net, see below)
   (validate in the form first; the backend check is the safety net). AGB + privacy checkboxes are frontend only.
7. Payment (`eligiblePaymentMethods`):
   - `paypal`: `query { createPaypalPayment }` → PayPal approval URL; after the return (`PAYPAL_RETURN_PATH`, default `checkout/success`)
     `addPaymentToOrder(input: { method: "paypal", metadata: { token, PayerID } })`
   - `stripe`: `mutation { createStripePaymentIntent }` → client secret for Stripe Elements (publishable key in Nuxt);
     the order is settled by the Stripe webhook `POST <APP_URL>/payments/stripe`
8. Confirmation mail with the voucher PDFs to the customer, copy to `info@tandem.flights` (GlobalSettings `orderEmailCopyTo`).
   `orderByCode(code)` for the success page.

### Public voucher check (`/qr?key=CODE`)

```graphql
enum VoucherCheckStatus { VALID USED EXPIRED NOT_FOUND }
type VoucherCheckResult {
  code: String!
  status: VoucherCheckStatus!
  validFrom: DateTime
  validUntil: DateTime
  productName: String   # in the request language, null for vouchers without product
}
extend type Query { checkVoucher(code: String!): VoucherCheckResult! }
```

```graphql
query ($code: String!) { checkVoucher(code: $code) { code status validFrom validUntil productName } }
```

- No personal data, no amount. Lookup is exact, then case-insensitive. Codes not matching `[0-9A-Za-z-]{4,32}` → `NOT_FOUND`.
- `USED` = balance 0 (redeemed in the shop or "Vor Ort eingelöst" in the dashboard) – wins over `EXPIRED` (`validUntil` passed, whole day counts).
- Rate limit: `CHECK_VOUCHER_RATE_LIMIT` (default 20) requests per client IP per minute (in-memory, per server process),
  then a GraphQL error with `extensions.code = "TOO_MANY_REQUESTS"`. Call it from the browser (or forward the client IP via
  `X-Forwarded-For` when calling from Nuxt SSR), otherwise all users share the Nuxt server's IP.

### Voucher redemption: on-site only

`SHOP_VOUCHER_REDEEM_ONLINE=false` (tandem default): vouchers – imported and newly sold – cannot be redeemed in the shop.
`applyCouponCode(couponCode)` with a voucher code returns
`CouponCodeInvalidError { errorCode: COUPON_CODE_INVALID_ERROR, message: "Der Gutschein ist nur vor Ort einlösbar" | "Il buono può essere riscattato solo in loco" | "The voucher can only be redeemed on-site" }`
(language of the request). Nuxt should not show a voucher/coupon field at all while the flag is off.
Vendure promotion coupon codes (if staff ever create promotions) are not affected. Set `true` once physical products are sold.

Staff redemption: Dashboard → Gutscheine → search the code → "Vor Ort eingelöst" (sets `amount` to 0). The /qr page then shows `USED`.

## Open points / needs credentials

- PayPal REST client id/secret (to be created, see "PayPal REST app"), Stripe secret + webhook secret + publishable key,
  Aruba SMTP password for info@tandem.flights, S3 bucket, DB, superadmin, Coolify webhook URL for `deploy.config.json`.
- Product title images (see above) and product texts review (it/en of the two hidden products).
- E-mail colours/logo in `static/email/templates` and `globalTemplateVars` are still the template defaults.
- `RateLimitPlugin` (global) stays disabled as in the template (it would throttle Nuxt SSR traffic).
- Elasticsearch is the template standard; for 7 products the DefaultSearchPlugin would be enough.
- Manually issued vouchers with PDF (old backend form "generatecoupon") – not implemented.
- `src/migrations` contains the template migration; the config uses `synchronize: true` like the template – create a fresh migration before go-live.
