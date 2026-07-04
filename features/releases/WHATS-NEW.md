# What's New — In-App Release Notes

**Screen:** `/whats-new`  
**Data source:** [`whats-new.ts`](./whats-new.ts)

---

## Access points

| Entry | Label |
|-------|-------|
| **Profile** (own profile) | What's New |
| **Settings → App** | Release Notes |
| **After major update** | One-time launch prompt on first app open |

---

## Page sections

1. **Known Issues** — structured feature status (maintenance, coming soon, temporary)
2. **Release history** — per-version features, fixes, performance
3. **Coming Soon** — roadmap highlights

### Known issue fields

| Field | Required |
|-------|----------|
| Feature name | Yes |
| Status | `under_maintenance` · `coming_soon` · `temporary_issue` |
| Short explanation | Yes |
| Expected fix version | Optional (e.g. `v1.0.2`) |

---

## Update checklist (every release)

1. **Prepend** a new object to `WHATS_NEW_RELEASES` (newest first).
2. Set `WHATS_NEW_LATEST_VERSION` to the new tag.
3. Refresh `WHATS_NEW_KNOWN_ISSUES` — remove fixed items, add new ones.
4. Refresh `WHATS_NEW_COMING_SOON` from the product roadmap.
5. Set `WHATS_NEW_LAUNCH_PROMPT_VERSION` for **major** updates (`null` for patch-only).
6. Update [`CHANGELOG.md`](../../CHANGELOG.md).
7. Run `npm run verify:whats-new`.

---

## Major update launch prompt

Set `WHATS_NEW_LAUNCH_PROMPT_VERSION = "vX.Y.Z"` to show a one-time modal after login.

- **View Release Notes** → opens `/whats-new`
- **Later** → dismisses; won't show again for that version
- Visiting `/whats-new` also marks the prompt as seen

Clear `WHATS_NEW_LAUNCH_PROMPT_VERSION` (set to `null`) for patch releases that shouldn't prompt.

---

## Verify

```bash
npm run verify:whats-new
```

---

## Related

- [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) — full release workflow
- [`STABILIZATION-v1.0.1.md`](./STABILIZATION-v1.0.1.md) — current stability window
- [`../training-calendar/ROADMAP.md`](../training-calendar/ROADMAP.md) — Coming Soon source
