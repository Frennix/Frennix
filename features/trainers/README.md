# Trainer Matching — Phase 14A

**Status:** Approved & complete  
**Separate from:** Training Partners (`/matching`)

## Scope

- Trainer account type (`profiles.is_trainer` + `trainer_profiles`)
- Dual-role accounts (athlete + trainer)
- Trainer profile: bio, experience, philosophy, years of experience
- **Trainer categories** (coach type): Personal Trainer, Strength Coach, Running Coach, Nutrition Coach, Bodybuilding Coach, Weight Loss Coach, Sports Performance Coach, Mobility/Flexibility Coach, Online Coach
- Specialties, certifications, availability, coaching formats
- Portfolio photos (transformation, client result, coaching)
- Social links (Instagram, TikTok, YouTube, Website, LinkedIn)
- Verification badges: Trainer (none), Verified Trainer, Featured Trainer
- Dedicated discovery at `/trainers` + Discover tab entry
- Search filters: goal, specialty, **category**, location, budget, format, verification
- Request-to-connect flow + gated messaging via `start_trainer_conversation`
- Admin certification review at `/admin-trainer-review`
- DB-only `trainer_reviews` table for future ratings (no UI)

## Not in 14A

- Payments, booking, subscriptions, revenue, review UI

## Phase 14B (planning only)

See [PHASE-14B.md](./PHASE-14B.md) — **Trainer Leads Dashboard** (profile views, connection requests, accepted connections, messages received). No payments, booking calendar, or subscriptions.

## Routes

| Route | Purpose |
|-------|---------|
| `/trainers` | Discovery + search |
| `/trainers/connections` | Pending + connected |
| `/trainer/[username]` | Public trainer profile |
| `/trainer-profile/setup` | First-time trainer setup |
| `/trainer-profile/edit` | Edit trainer profile |
| `/admin-trainer-review` | Admin cert review |

## Migrations

- `supabase/migrations/20250627000001_trainer_matching.sql`
- `supabase/migrations/20250628000001_trainer_categories.sql`

## Manual QA

- [ ] Athlete finds trainer via Discover → Find a trainer
- [ ] Filters work (specialty, **category**, city, budget, format, verification)
- [ ] Trainer selects categories on profile edit; categories show on discovery + public profile
- [ ] Request to connect → trainer accepts → both can message
- [ ] Verified badge after admin approves certification
- [ ] Featured badge after admin sets level
- [ ] Portfolio photos display on profile + discovery preview
- [ ] Social links open correctly
- [ ] Training Partners flow unchanged (`/matching`)
