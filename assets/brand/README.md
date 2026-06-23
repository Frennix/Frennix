# Frennix official brand assets

**Permanent source of truth:** `frennix-logo.png`

This is the approved official Frennix logo. All branding — app UI, website, social, and merchandise — must reference this file or its layout exports. Do **not** create or use alternate, temporary, placeholder, or replacement logos unless explicitly approved.

**Tagline:** CONNECT. TRAIN. GROW.

**Colors:** Dark charcoal `#0A0A0B` · White `#FAFAFA` · Electric green `#22C55E`

---

## File paths

| Asset | Path | Use |
|-------|------|-----|
| **Master logo** | `assets/brand/frennix-logo.png` | Official artwork — symbol, FRENNIX wordmark, tagline |
| Wordmark export | `assets/brand/frennix-logo-full.png` | Cropped from master — headers, login, signup |
| Symbol export | `assets/brand/frennix-logo-icon.png` | Cropped from master — compact UI, push notifications |
| Website / general marketing | `assets/brand/marketing/frennix-logo-official.png` | Exact copy of master |
| Social media | `assets/brand/marketing/social/frennix-logo-official.png` | Exact copy of master |
| Merchandise mockups | `assets/brand/marketing/merchandise/frennix-logo-official.png` | Exact copy of master |
| App icon | `assets/icon.png` | iOS/Android home screen (from master symbol) |
| Splash screen | `assets/splash-icon.png` | Launch screen on `#0A0A0B` (from master) |
| Adaptive icon | `assets/adaptive-icon.png` | Android adaptive foreground (from master symbol) |

Layout exports (`frennix-logo-full.png`, `frennix-logo-icon.png`) are crops/scales of the master — not separate logo designs.

---

## In-app usage

Use `@/components/FrennixLogo` everywhere. It loads only from the master exports above.

| Surface | Variant |
|---------|---------|
| Welcome / splash-style screens | `mark` (full artwork + tagline) |
| Login, signup, feed/events headers | `full` (wordmark) |
| Profile header, settings, notifications | `icon` (symbol) |
| App icon, splash, adaptive icon | `assets/icon.png`, `splash-icon.png`, `adaptive-icon.png` |
| Push notifications | `assets/brand/frennix-logo-icon.png` via `app.config.ts` |

**Expo config:** `app.config.ts` → `./assets/icon.png`, `./assets/splash-icon.png`, `./assets/adaptive-icon.png`
