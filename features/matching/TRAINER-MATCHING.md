# Trainer Matching — Phase 14A (live)

**Status:** Phase 14A approved & complete. Phase 14B planning: [Trainer Leads Dashboard](../trainers/PHASE-14B.md) — no payments, booking, or subscriptions.

---

## Goal

Trainers should be able to create trainer profiles, and users looking for a trainer should have a clear place in the app to find and connect with trainers who fit their needs.

This is **separate from Training Partners** (peer athlete ↔ athlete matching at `/matching`).

---

## Requirements (from product)

### 1. Trainer profile type

- Distinct profile mode or record type: **Trainer** vs regular athlete
- Trainers opt in to being discoverable as coaches
- Clients browse trainers without mixing into peer training partner deck

### 2. Trainer profile fields

| Field | Purpose |
|-------|---------|
| Bio | Who they are, coaching philosophy |
| Specialties | e.g. strength, mobility, marathon prep, weight loss |
| Certifications | NASM, ACE, CSCS, etc. (display + optional verification later) |
| Location | City/region; supports in-person discovery |
| Availability | Days/times or general schedule |
| Pricing / packages | Session rates, packages, intro offers |

### 3. User filter options (client side)

Clients filtering trainer discovery by:

- **Goal** — aligns with client fitness goals
- **Training style** — e.g. HIIT, powerlifting, yoga, sports-specific
- **Location** — nearby or remote
- **Budget** — price range / package tier
- **Online vs in-person** — delivery format

### 4. Trainer discovery section

- Dedicated navigation entry (not `/matching`)
- Trainer cards distinct from `TrainingPartnerCard` — professional coaching UX
- Rank/filter by relevance (specialty, location, budget, availability)

### 5. Match or request-to-connect flow

**Product decision at kickoff:**

| Option | Behavior |
|--------|----------|
| **Mutual match** | Both swipe/connect (similar to peer deck) |
| **Request to connect** | Client requests; trainer accepts/declines |
| **Hybrid** | Client requests; trainer can also invite clients |

Must use fitness/coaching language — **Connect**, **Request coaching**, **New training client** — not dating terminology.

### 6. Messaging after match

- Once trainer and user connect, open DM via existing chat pipeline (or trainer-specific conversation type TBD)
- Notifications: new trainer match, new message from trainer/client
- Deep links to chat

### 7. Trust & safety before launch

- Certification display guidelines (self-reported vs verified TBD)
- Report/block integration (extend existing moderation)
- Trainer profile review or approval workflow (TBD)
- Privacy policy section for trainer–client data
- No launch without safety checklist sign-off

---

## Out of scope for Phase 14 kickoff (unless requested)

- Payment processing / in-app booking
- Calendar scheduling integration
- Video sessions
- Peer training partner changes (Phases 4–13 remain as-is)

---

## Phase 14B (planning)

**Trainer Leads Dashboard** — profile views, connection requests, accepted connections, messages received.  
See `features/trainers/PHASE-14B.md`. No payments, booking calendar, or subscriptions.

---

## Suggested phase breakdown (historical)

| Sub-phase | Focus |
|-----------|--------|
| 14A | Schema + trainer profile CRUD |
| 14B | Trainer onboarding & profile UI |
| 14C | Client discovery + filters |
| 14D | Connect / request flow |
| 14E | Notifications + messaging |
| 14F | Trust & safety + launch QA |

---

## Approval gate

Do **not** start Phase 14 until:

1. Phase 13 production sign-off complete (device QA + privacy policy)
2. Explicit **“Proceed with Phase 14”** approval
3. Product decision on connect vs request-to-connect flow
