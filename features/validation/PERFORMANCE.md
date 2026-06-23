# Performance baselines — Phase 15

Measure before and during beta. Client events stored as `perf_*` in `product_events`; admin summary at **Settings → Product analytics**.

## Scripts

```bash
cd apps/mobile

# Feed
npx tsx scripts/measure-feed-perf.ts <userId>

# Messaging
npx tsx scripts/measure-messaging-perf.ts <userId> <conversationId>

# Trainer search (requires TEST_USER_JWT)
TEST_USER_JWT=... npx tsx scripts/measure-trainer-search-perf.ts

# Match candidates (existing)
TEST_USER_JWT=... npx tsx scripts/load-test-match-candidates.ts
```

## Client-side perf events

| Event | When |
|-------|------|
| `perf_screen_load` | Route change (duration_ms, screen) |
| `perf_feed_load` | First feed load per session |
| `perf_messaging_load` | Chat messages first load |

## Initial targets

| Metric | Target |
|--------|--------|
| Feed load p95 | < 1200ms |
| Messaging load p95 | < 800ms |
| Trainer search p95 | < 600ms |
| Screen load p95 | < 1500ms |

Record baseline numbers here after first beta week:

| Metric | Baseline | Date |
|--------|----------|------|
| Feed | | |
| Messaging | | |
| Trainer search | | |
