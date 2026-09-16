# Atlanta Tennis Platform - Payments & Backend Technical Assessment

**Prepared:** 16 September 2026  
**Scope:** discovery and technical validation; not a commitment to build the full platform.

## Executive conclusion

We can safely build the first-season payment and capacity core using a modular Node/Express API, MongoDB, an asynchronous payment-provider layer, and signed server-to-server notifications. The supplied payment test bed proves the highest-risk mechanics for a Stripe card flow: server-calculated pricing, atomic capacity reservation, Stripe PaymentIntents, 3DS-capable Elements, signed webhooks, replay-safe event handling, expiry recovery, and reconciliation.

This is **not** evidence that Worldpay or E2Pay are approved, drop-in equivalents, nor that the complete tennis rules, merchant onboarding, refunds/disputes operations, or 100,000-user platform are ready. Those require client decisions, provider credentials, and provider-specific sandbox validation.

## A. Recommended payment architecture

```text
Web / future mobile app
        | request: register for league/division
        v
Registration API -- validates player, eligibility, price, capacity
        | atomic slot hold with expiry
        v
Payment service (provider-neutral internal contract)
   | Stripe adapter (implemented/tested)
   | Worldpay adapter (research/validation required)
   ` E2Pay adapter (research/validation required)
        |
Provider hosted UI / Elements -> provider processing -> signed webhook
        |
Webhook ingestion + idempotency + audit log -> registration state transition
```

The browser initiates a payment but does not authoritatively mark a registration as paid. The server accepts only provider-confirmed state: the signed webhook is the durable path and a server-side PaymentIntent retrieval is a short-lived reconciliation aid. The implemented `PaymentProvider` interface contains create, retrieve and refund operations; provider IDs and provider-specific fields must remain stored alongside common internal statuses.

## B. Stripe - proven, known, and still to test

### Proven in the supplied harness

- A PaymentIntent is created server-side using the database product price; client amount/currency is ignored.
- A reservation ID is used as the Stripe idempotency key for intent creation.
- Stripe PaymentElement supports cards and required 3D Secure authentication.
- The webhook endpoint uses Stripe signature verification and persists/claims event IDs so duplicate delivery is a no-op.
- Terminal failure/cancellation moves only a `pending` reservation, so stock cannot be released twice.
- Successful webhook or server reconciliation confirms the reservation; stock remains consumed.
- A cleanup worker expires abandoned pending holds and reconciles stale pending orders after restart.
- Admin operations show current order/payment state, and audit logs capture payment transitions, refunds, disputes, and stock adjustments.

### Must be sandbox-tested before production sign-off

1. Success, decline, insufficient funds, expired card, 3DS success/failure.
2. Duplicate webhook resend and an out-of-order terminal event.
3. Browser loss after success; delayed/missed webhook; application restart.
4. Full and partial refund, plus refund failure and multiple partial refunds.
5. `charge.dispute.created` and `charge.dispute.closed` using Stripe test tooling; confirm operations queue and evidence workflow.
6. Provider API timeout during creation/retrieval/refund, Stripe rate limits, and recovery alerting.

## C. Worldpay and E2Pay - researched, not integrated

| Provider | Confirmed from official docs | Must verify with merchant/onboarding |
|---|---|---|
| Stripe | PaymentIntents, Elements, signed webhooks, idempotency, refunds/disputes, test mode | account capability, geography, fee/settlement terms, Radar configuration, production webhook and restricted-key policy |
| Access Worldpay | Hosted Payment Pages plus payments APIs; authorization/settlement/cancel/refund/query; Try and Live environments; webhooks with HMAC/certificate validation and retries | exact product/contract, MID, countries/currencies, API versions, 3DS/risk services, webhook registration, refund/chargeback flows, test credentials |
| E2Pay | Hosted payment and direct/server API options; sandbox/production endpoints; re-query API described in published material | correct regional E2Pay entity/product, merchant onboarding, supported USD/card capability, callback signing algorithm, webhook/re-query reliability, refund/dispute API, test credentials |

**Decision:** do not code either adapter until Saad identifies the legal merchant, operating country, target payment methods/currencies, and provider product. Implementing three APIs before that would create unsupported payment behavior and an untestable liability.

## D. Merchant model and operational responsibility

The tennis business (or the legal entity that sells league registrations) should own the provider merchant account, bank payout destination, Stripe/Worldpay/E2Pay onboarding documents, refunds, and dispute liability. Vision71 should receive delegated technical access only, never casually own client funds or use its own merchant account. Before launch, document: legal merchant, statement descriptor, bank owner, refund policy/approver, dispute evidence owner, finance reconciliation owner, support contact, and suspension/alternative-provider playbook.

## E. Common state model

```text
AVAILABLE -> HELD -> PAYMENT_PENDING -> PAID -> REGISTERED
               |          |               |
               v          v               v
          HOLD_EXPIRED PAYMENT_FAILED   REFUNDED
                          CANCELLED      DISPUTED
```

`HELD` is an atomic capacity reservation with an expiry. `PAYMENT_PENDING` is a provider attempt linked to that hold. Only signed notification or provider-server reconciliation moves an item to `PAID`; registration fulfilment follows that transition. A refund does not automatically remove a player: that is a defined business operation. A dispute must flag the registration and create an operations task rather than silently erase history.

## F. Failure scenarios and expected handling

| Scenario | Control / expected result |
|---|---|
| Two players take last place | guarded atomic decrement permits one hold only; other receives 409 |
| Client alters price/currency | server retrieves fee/currency from the league record |
| User clicks pay twice | one registration attempt ID and provider idempotency key; reuse PaymentIntent |
| Network times out during create | persist operation/hold, retry with same idempotency key, retrieve by provider ID |
| Payment succeeds but redirect fails | signed webhook/reconciliation marks paid; no browser dependence |
| Webhook arrives twice | atomically claim unique provider event ID; subsequent request is no-op |
| Webhook is delayed/server restarts | queued retry from provider plus scheduled provider reconciliation and expiry job |
| Payment fails while place held | transition pending hold to failed and release capacity exactly once |
| Checkout abandoned | expiry worker cancels eligible payment intent and returns capacity |
| Refund issued after registration | provider refund event marks payment refunded; admin applies defined cancellation/eligibility process |
| Dispute/chargeback | dispute event marks disputed, preserves audit history, alerts operations/evidence owner |
| Provider outage | show “payment temporarily unavailable”; preserve a short-lived hold only if retry is safe; never switch providers mid-attempt without a new explicit payment attempt |

## G. Tennis data architecture - proposed, not implemented

Core entities: `User`, `PlayerProfile`, `RoleAssignment`, `LeagueSeason`, `Division`, `Registration`, `CapacityHold`, `Payment`, `Refund`, `Dispute`, `Match`, `MatchResult`, `StandingSnapshot`, `EligibilityDecision`, and `AuditLog`.

Use immutable event/audit records for financial and score changes. Registrations reference a season/division and a player; matches/results reference registrations, not mutable display names. Keep derived statistics/leaderboards rebuildable from match results. Index season/division capacity, player registration history, match schedule, geographic fields, payment provider IDs, and webhook event IDs.

## H. Division and history model

Do not hard-code “last year’s winner cannot play again.” Store an `EligibilityDecision` with policy version, inputs, outcome, override reason, decision maker, and timestamps. The first business workshop must decide ranking window, winner rule duration, player-appeal process, age/gender/division constraints, and override authority. Historical results must remain immutable when policy changes.

## I. RBAC and manual registration

Recommended roles: **Super Admin** (roles/configuration), **League Admin** (season/division/registration decisions), **Operations/Finance** (refunds, manual-payment reconciliation, support), **Score Official** (results only), and **Player** (own profile/registration only). Replace the current local admin-key demo with authenticated users, server-issued sessions/tokens, role checks per endpoint, MFA for finance/super-admin actions, and audit identity.

Manual registration requires: player source/contact consent, creator identity, chosen division, authoritative fee, manual payment method/reference or explicit waiver reason, payment/registration status, and complete before/after audit records. A manual “paid” override needs a second-person approval policy or finance role.

## J. Scale plan

| Stage | Recommended shape | Real bottlenecks / next change |
|---|---|---|
| First season (~500 participants) | modular monolith, MongoDB replica set, Stripe, background worker, managed logs/backups | operational process, webhook reliability, capacity contention at registration opening |
| ~10,000 users | horizontal API replicas, Redis for cache/rate limits/job queue, CDN/object storage, Mongo indexes/read replicas as measured | leaderboards/search, notification bursts, connection pool saturation |
| ~100,000 traffic/users | independently scale worker/webhook/notification workloads, managed queue with DLQ, analytics read model, load testing, WAF/observability | not automatically 100k concurrent users; quantify concurrency, geography, RPO/RTO and season-opening peak first |

Do not introduce microservices, Kubernetes, or many databases until measurement shows an isolated scaling or deployment need.

## K. Security controls and gaps

Implemented: server-computed amount; test-mode Stripe keys in environment variables; raw-body signed Stripe webhook verification; event idempotency; server reconciliation; restricted admin-key gate; no card data storage; stock/capacity atomic guards; audit model.

Required before production: secret manager and key rotation; HTTPS/HSTS; proper user authentication and RBAC; input validation schemas; rate limiting/WAF; CSRF policy where cookie sessions are used; encrypted backups; PII retention/deletion policy; redacted structured logs; Sentry/metrics/alerts; least-privilege provider keys; database network/IP controls; dependency/SAST scanning; incident runbook; PCI responsibility confirmation. Never store PAN, CVC, raw card details, Stripe client secrets, or unnecessary PII in logs/metadata.

## L. Unknowns and decisions required from Saad

1. Legal merchant entity, country, currencies, target payment methods, payout owner and statement descriptor.
2. Which provider(s) are actually contracted/approved; Worldpay/E2Pay product, sandbox access and support contacts.
3. Refund, cancellation, no-show, dispute and manual-payment policy.
4. Exact first-season scope, registration fee matrix, divisions, capacity, waitlist and refund deadlines.
5. Eligibility rules, winner treatment, rating/ranking source, appeals, overrides and audit requirements.
6. Geographic matching definition: ZIP source, radius/boundaries, automatic vs admin choice.
7. Identity, safeguarding/age, privacy, notification and data-retention obligations.
8. Definition of “100,000”: total registered users, monthly visits, or peak concurrent traffic.
9. Required admin roles, staff count, manual-registration workflow and finance approval policy.
10. Production support ownership, availability target, backups, incident response and budget.

## Evidence package / how to demonstrate the current harness

1. Run `npm run server:seed` and `npm run dev`.
2. Run `stripe listen --forward-to localhost:3001/api/webhooks/stripe`; set the printed `whsec_` value as `STRIPE_WEBHOOK_SECRET` and restart the server.
3. Run `npm run test:concurrency` to prove exactly one success for Ivory T-Shirt’s one unit. For the three-unit scenario run `$env:PRODUCT='Clay T-Shirt'; $env:CONCURRENCY='10'; npm run test:concurrency`.
4. Demonstrate Stripe cards: `4242 4242 4242 4242` success; `4000 0000 0000 9995` insufficient funds; `4000 0000 0000 0002` decline; `4000 0027 6000 3184` 3DS; 4242 with a past expiry.
5. In Stripe CLI, resend a delivered event and confirm no duplicate order/stock change. Show `webhookEventIds` and AuditLog in MongoDB/admin API.
6. Start checkout then abandon it; use short `RESERVATION_HOLD_MINUTES` during demo and show cleanup releasing stock.
7. Send an amount in the reserve request and show the server charges the catalog amount instead.
8. In admin, show a successful payment moves out of pending via signed webhook/reconciliation; request a refund endpoint and demonstrate a `charge.refunded` webhook. Dispute test remains a pre-production sandbox test item.

## Current project mapping

The commerce UI is only a visual test surface; its Product maps directly to a future League/Division slot. `availableStock` is the atomic remaining capacity; `Reservation` is the expiring registration hold; `Order` is the provider-linked payment/transaction; Socket.IO demonstrates reactive capacity updates. These mechanisms answer the payment/concurrency portion of the tennis brief but do not claim player/league/history/RBAC implementation.

## Sources

- Stripe official docs: PaymentIntents; webhook handling; PaymentIntent status verification; server-side refunds/disputes; idempotent requests.
- Worldpay official docs: Access APIs; event webhooks; Card Payments API; API principles.
- E2Pay official docs: hosted integration APIs; Direct API; gateway overview.
