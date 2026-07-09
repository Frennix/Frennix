# Startup Verification Log

**Date:** 2026-07-08  
**Production URL:** https://frennix.vercel.app  
**Bundle:** `index-a3b9ed32af9d64eb8628d3d0b55d4682.js`  
**Commit:** `8cb85d5`  
**Result:** **16/16 core** · 6/6 extended · 3/3 platform matrix

```
=== Beta startup verification @ https://frennix.vercel.app ===
HTML boot shell: yes
HTML pointer-events auto: yes
PASS  1. Existing user launch (no black screen) — rootH=844 feedH=0 errors=none trace=app-error-boundary-root:mounted→gesture-handler:mounted→tabs-layout:render→feed-route:render→feed-route:layout-effect→tabs-layout:layout-effect→feed-route:mounted→tabs-layout:mounted text=STORIES EB ＋ Your Story 1 day streak Your Story Share workout Explore Stories Fi
PASS  2. New user routes to onboarding or loading (not blank) — Set up profile Your profile Tap to add photo Username Display name Bio City Continue
PASS  3a. Logout shows login/loading — auth=false text=Welcome back Train together. Grow together. Email Password Sign in Forgot passwo
PASS  3b. Re-login reaches feed/loading — STORIES EB ＋ Your Story 1 day streak Your Story Share workout Explore Stories Fi
PASS  4. Slow network shows loading UI early — Share workout Explore Stories Find athletes Events Discover Find your training community MATCHING Fi
PASS  4b. Slow network eventually reaches feed — STORIES EB ＋ Your Story 1 day streak Your Story Share workout Explore Stories Fi
PASS  5. Profile fetch blip — app stays usable — STORIES EB ＋ Your Story 1 day streak Your Story Share workout Explore Stories Find athletes Events E
PASS  5b. Retry UI shipped in build
PASS  7. Expired session → login/loading — Welcome back Train together. Grow together. Email Password Sign in Forgot passwo
PASS  8. Offline startup shows fallback UI — Share workout Explore Stories Find athletes Events Discover Find your training c
PASS  9. Cached PWA reaches feed/loading — STORIES EB ＋ Your Story 1 day streak Your Story Share workout Explore Stories Fi
PASS  10. Fresh Safari install → login/loading — Welcome back Train together. Grow together. Email Password Sign in Forgot passwo
PASS  11. Home Screen install reaches feed/loading — STORIES EB ＋ Your Story 1 day streak Your Story Share workout Explore Stories Fi
PASS  12. Returning user (7+ days) reaches app — STORIES EB ＋ Your Story 1 day streak Your Story Share workout Explore Stories Fi
PASS  P1. Safari PWA startup — STORIES EB ＋ Your Story 1 day streak Your Story Share workout Explore Stories Fi
PASS  P2. Chrome desktop startup — STORIES EB ＋ Your Story 1 day streak Your Story Share workout Explore Stories Fi
PASS  P3. iPhone Home Screen startup — STORIES EB ＋ Your Story 1 day streak Your Story Share workout Explore Stories Fi
PASS  6. Regression: push/WebPush
PASS  6. Regression: messages tab
PASS  6. Regression: feed
PASS  6. Regression: stories
PASS  6. Regression: events/calendar
PASS  6. Regression: profile
PASS  6. Regression: discover
PASS  6. Regression: error boundary retry

=== Core startup: 16/16 checks passed ===
=== Extended scenarios: 6/6 checks passed ===
=== Platform matrix: 3/3 checks passed ===
```

## Root cause (check 3a)

Supabase kept an **in-memory session** after `localStorage` auth keys were cleared. React still had `session` set while `profile` was null, so the index gate showed **"Loading your profile"** instead of routing to login. The verification script also re-seeded auth tokens via stacked `addInitScript` handlers on reload.

## Fix

- `lib/auth-storage.ts` — storage/token sync helpers (`clearAllPersistedAuth`, `sessionMatchesPersistedAuth`)
- `providers/AuthProvider.tsx` — purge in-memory session when storage has no token; skip recovery grace without persisted auth
- `app/index.tsx` — redirect to login when `!hasPersistedAuthToken()`
- `scripts/verify-beta-startup.mjs` — fresh browser context for logout test; platform matrix (Safari PWA, Chrome desktop, Home Screen)
