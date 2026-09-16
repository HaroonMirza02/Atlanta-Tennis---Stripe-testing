# Stripe Sandbox Evidence - 16 September 2026

This record distinguishes direct Stripe API evidence from end-to-end application evidence. Test mode only; no PAN, CVC, client secret, or API key is recorded.

## Executed evidence

| Test | Method | Observed result | Evidence |
|---|---|---|---|
| Successful card payment | Direct Stripe test API, `pm_card_visa`, $48.00 | PaymentIntent succeeded | `pi_3UGG7r3LwR6lzVYP198YlRyi` |
| Generic decline | Direct Stripe test API, decline test method | `card_error`: “Your card was declined.” | 16 Sep 2026 run |
| Insufficient funds | Direct Stripe test API, insufficient-funds test method | `card_error`: “Your card has insufficient funds.” | 16 Sep 2026 run |
| Expired card | Direct Stripe test API, expired-card test method | `card_error`, code `expired_card` | 16 Sep 2026 run |
| 3DS required | Direct Stripe test API, authentication-required test method | PaymentIntent `requires_action`; `next_action=use_stripe_sdk` | `pi_3UGG8N3LwR6lzVYP1IRRGCJV` |
| Duplicate payment request | Two identical direct Stripe test API requests with one idempotency key | Both calls returned the same succeeded PaymentIntent; no second intent was created | `pi_3UGG8i3LwR6lzVYP1mcb8cei` |

## Finding fixed during execution

The test account has redirect-capable payment methods enabled in the Stripe Dashboard. Creating an automatic-payment-method intent without a `return_url` was rejected by Stripe. The card-only harness now sets `automatic_payment_methods.allow_redirects=never`; a future redirect-payment-method implementation must instead supply and securely process its return URL.

## Not executed / blocked end-to-end evidence

The local API did not reach “Connected to Database” against the configured Atlas instance, so no local order/reservation record could be created and no signed webhook could be correlated to it. Therefore the following must not be marked passed:

- Stripe CLI duplicate event and out-of-order terminal-event delivery through the local signed webhook endpoint.
- Browser disconnect after a completed UI payment, followed by application reconciliation.
- Application full/partial/second-partial/failed refund handling and `charge.refunded` webhook state change.
- Stripe dispute lifecycle routed to the application webhook and an operations task.
- Fault injection for Stripe create/retrieve/refund with observable operator alerting.

## Next execution prerequisites

1. Restore Atlas network access or use an approved local MongoDB test database.
2. Start the API and confirm `/api/health` returns 200 and startup logs show database connection.
3. Run `stripe listen --forward-to localhost:3001/api/webhooks/stripe`, place its `whsec_` value in local `.env`, and restart the API.
4. Repeat the remaining six sign-off groups while recording provider event IDs, local order/reservation IDs, stock before/after, webhook arrival order and redacted logs.
