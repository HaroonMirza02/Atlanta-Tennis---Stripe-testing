# MERN + Stripe Concurrency & Payment Edge-Case Test Bed

A robust full-stack e-commerce application designed to **stress-test Stripe payment integrations under high concurrency and failure conditions**. It guarantees no overselling via MongoDB atomic decrements and features real-time stock updates.

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   The `.env` file should be populated with the following variables:
   ```env
   MONGODB_URI=mongodb+srv://...
   STRIPE_SECRET_KEY=sk_test_...
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   PORT=3001
   CLIENT_URL=http://localhost:5173
   # Set this outside local demos to protect /admin.
   ADMIN_API_KEY=replace-with-a-long-staff-secret
   ```

3. **Stripe Webhook Forwarding (Local Testing)**
   Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:3001/api/webhooks/stripe
   ```
   *Copy the webhook signing secret (`whsec_...`) printed in your terminal and update `STRIPE_WEBHOOK_SECRET` in your `.env` file.*

4. **Seed Database**
   Seed the 10 required test products:
   ```bash
   npm run server:seed
   ```

5. **Start the Application**
   Run both frontend and backend concurrently:
   ```bash
   npm run dev
   ```

## Test Card Matrix

Use the following Stripe test cards to verify edge-cases during checkout:

| Scenario | Card Number | Exp Date | CVC | Expected Result |
|----------|-------------|----------|-----|-----------------|
| Success | `4242 4242 4242 4242` | Any future | Any | Payment succeeds, stock permanently decremented. |
| Insufficient Funds | `4000 0000 0000 9995` | Any future | Any | Payment fails, stock released immediately via webhook. |
| Generic Decline | `4000 0000 0000 0002` | Any future | Any | Payment fails, stock released immediately via webhook. |
| 3D Secure | `4000 0027 6000 3184` | Any future | Any | Prompts for 3DS auth. On success, stock held; on fail, stock released. |
| Expired Card | `4242 4242 4242 4242` | Any past | Any | Immediate UI error, payment intent not finalized. |

## Edge-Case Test Matrix

| # | Scenario | Expected behavior | Reproduction Steps |
|---|----------|-------------------|--------------------|
| 1 | Two+ users click "Buy" on the same item at the same instant, stock = 1 | Exactly one reservation succeeds; the other gets an immediate out-of-stock response; no negative stock ever occurs | Seed, then run `npm run test:concurrency` against **The Essential Tee — Ivory** with 5 concurrent requests. |
| 2 | N concurrent requests for an item with stock = 3 | Exactly 3 succeed, the rest are rejected | Seed, choose a three-unit SKU (for example **Sunday Wash Tee — Clay**) and run the script with 10 concurrent requests. |
| 3 | User reserves stock, then abandons checkout (closes tab) | Reservation expires after timeout; stock is released and becomes purchasable again | Click "Buy", close the modal or tab. Wait 5 mins (or `CLEANUP_INTERVAL_MS`). Stock will reappear. |
| 4 | User reserves stock, payment fails (declined card) | Stock is released immediately via webhook handling; order marked failed | Use test card `4000 0000 0000 0002`. Check UI to see stock return instantly. |
| 5 | User reserves stock, payment succeeds | Order confirmed; stock stays decremented permanently; reservation marked confirmed | Use test card `4242 4242 4242 4242`. Stock remains depleted. |
| 6 | Stripe redelivers the same webhook event twice | Second delivery is a no-op; no double stock changes, no duplicate order records | Use Stripe CLI to resend an event: `stripe events resend evt_xxx`. Observe logs ignoring duplicate. |
| 7 | Client attempts to tamper with price/amount sent to the server | Server ignores client-sent price and recomputes from DB | Intercept API request using dev tools, change amount. Stripe Elements will still charge the DB price. |
| 8 | Item already at 0 stock before any checkout attempt | Buy button disabled in UI; API also rejects the reserve call server-side | Observe **Studio Pocket Tee — Ink** on the homepage. |
| 9 | Network drop / retry during PaymentIntent creation | Idempotency key prevents duplicate PaymentIntent/charge creation for the retried request | Disconnect network mid-request or replay the POST `/api/reserve` with the same `x-session-id`. |
| 10 | 3D Secure required card | Frontend correctly handles the `requires_action` flow via Stripe Elements and completes authentication | Use test card `4000 0027 6000 3184` and complete the modal prompt. |
| 11 | Partial-quantity request exceeding available stock | Rejected atomically, no partial fulfillment, clear error to user | Send POST `/api/reserve` with `quantity: 2` on an item with 1 stock. Response 409 Conflict. |
| 12 | Server restarts while a reservation is `pending` | On restart, the expiry-cleanup job still finds and releases any stale pending reservations | Create reservation, stop server, start server. Background job runs and cleans up. |

## Load-Testing Script
Run the built-in load testing script to prove race conditions are handled:
```bash
npm run test:concurrency
```
*Note: Ensure the backend is running before executing the test.*

The default run targets the one-unit **Ivory T-Shirt**. To prove the three-unit case:
```powershell
$env:PRODUCT='Clay T-Shirt'; $env:CONCURRENCY='10'; npm run test:concurrency
```

## Storefront and operations

The seeded catalog is an editorial collection of exactly 10 T-shirt SKUs, each capped at five available units. The public storefront receives live stock changes through Socket.IO. Visit `/admin` to view sellable inventory, pending holds, paid revenue, and the latest Stripe payment attempts. Staff can adjust the **currently sellable** unit count from 0–5; the immutable `totalStock` seed baseline remains intact for audit clarity.

For a real deployment, set `ADMIN_API_KEY` and enter it at `/admin`. The local test harness permits an empty key only when that environment variable is deliberately absent.

## Tennis-platform assessment

The project has been assessed against the Atlanta Tennis backend/payment brief. The detailed scope decision, provider analysis, state model, failure scenarios, testing evidence and explicit unknowns are in [the technical assessment](docs/TENNIS_PLATFORM_TECHNICAL_ASSESSMENT.md) and its rendered PDF at `output/pdf/Atlanta_Tennis_Technical_Assessment.pdf`.

The Stripe adapter is implemented and testable. Worldpay and E2Pay are intentionally represented as future adapters, not claimed integrations: their merchant contract, geography/currency capability, credentials, callback/security configuration and sandbox behavior must be validated before implementation.

Before production sign-off, execute and record the six required sandbox proof groups in the assessment: card/3DS outcomes, duplicate and out-of-order webhooks, lost browser redirect, full/partial/failed refunds, dispute lifecycle, and Stripe API failure/latency handling.
