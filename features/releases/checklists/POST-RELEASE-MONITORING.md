# Post-Release Monitoring Checklist

**Phase:** 6 of 7  
**Duration:** 24–48 hours after production deploy  
**Owner:** Engineering + Founder

---

## Monitoring schedule

| Window | Focus |
|--------|-------|
| **0–2 hours** | Immediate smoke re-check; Sentry error rate |
| **2–24 hours** | Analytics funnel; Beta Feedback queue; performance |
| **24–48 hours** | Trend analysis; user reports; release completion decision |

---

## Error & crash monitoring

| # | Check | 0–2h | 24h | 48h | Notes |
|---|-------|------|-----|-----|-------|
| 1 | Sentry — no new P0/P1 issues | ⬜ | ⬜ | ⬜ | |
| 2 | Sentry — error rate vs baseline | ⬜ | ⬜ | ⬜ | |
| 3 | Vercel deployment health | ⬜ | ⬜ | ⬜ | |
| 4 | Native crashes (if native build shipped) | ⬜ | ⬜ | ⬜ | |

---

## Analytics monitoring

| # | Check | 0–2h | 24h | 48h | Notes |
|---|-------|------|-----|-----|-------|
| 5 | DAU / session events firing | ⬜ | ⬜ | ⬜ | |
| 6 | Release-specific events (e.g. match_*) | ⬜ | ⬜ | ⬜ | |
| 7 | Founder Dashboard metrics sane | ⬜ | ⬜ | ⬜ | |

---

## Beta Feedback & user reports

| # | Check | 0–2h | 24h | 48h | Notes |
|---|-------|------|-----|-----|-------|
| 8 | New Beta Feedback triaged | ⬜ | ⬜ | ⬜ | `/founder/support` |
| 9 | No surge in bug reports | ⬜ | ⬜ | ⬜ | |
| 10 | No black-screen / login reports | ⬜ | ⬜ | ⬜ | |

---

## Performance monitoring

| # | Check | 0–2h | 24h | 48h | Notes |
|---|-------|------|-----|-----|-------|
| 11 | Screen load times (`perf_screen_load`) | ⬜ | ⬜ | ⬜ | |
| 12 | RPC latency (match candidates, feed) | ⬜ | ⬜ | ⬜ | |
| 13 | Web bundle load time | ⬜ | ⬜ | ⬜ | |

---

## Rollback decision log

| Time | Issue | Severity | Action taken |
|------|-------|----------|--------------|
| | | | |

---

## Sign-off

| Role | Name | Date | Monitoring period clear |
|------|------|------|-------------------------|
| Engineering | | | ⬜ |
| Founder | | | ⬜ |

**48h clear required before Phase 7 (Release Completion).**

If rollback occurred, document in release file and skip to rollback completion checklist.
