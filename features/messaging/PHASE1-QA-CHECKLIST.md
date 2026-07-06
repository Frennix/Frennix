# Messaging Inbox QA Checklist

**Status:** QA on staging only — do **not** promote to production until signed off  
**Staging URL (Vercel preview):** https://mobile-lxb58wato-frennix-s-projects.vercel.app  
**Note:** Preview deployments require Frennix Vercel team SSO on first visit. Production was **not** updated.  
**Branch:** `release/messaging-inbox-qa` · **Commit:** `7350352` · **Deploy:** `dpl_4tmBENpvShyMU2ZxL8JUwpurgwNz`

---

## Pre-flight

- [ ] Migration `20260705000001_messaging_phase1_inbox.sql` applied to Supabase
- [ ] Staging URL loads and you can sign in
- [ ] Hard refresh on iPhone Safari (or open in private tab) to avoid cached bundle

---

## Where to find controls (iPhone Safari)

| Action | How |
|--------|-----|
| **Edit / multi-select** | Messages tab → **Edit** (top bar, below header) |
| **Three-dot menu** | **⋮** on the right of each inbox row |
| **Long-press menu** | Press & hold a row ~½ second |
| **Swipe delete** | Native app only — **not** on Safari web |

---

## 1. Single conversation delete

- [ ] Tap **⋮** → **Delete Conversation** → confirm **"Delete Conversation?"**
- [ ] Cancel keeps the thread in your inbox
- [ ] Delete removes it from **your** inbox immediately
- [ ] Other account still sees the full thread
- [ ] Long-press → same delete flow works

---

## 2. Multi-select (Edit mode)

- [ ] Tap **Edit** → rows show check circles; swipe disabled
- [ ] Tap rows to select / deselect
- [ ] **Select All** selects all inbox rows; **Deselect All** clears
- [ ] **Delete Selected** → confirm **"Delete selected conversations?"** → rows disappear
- [ ] **Archive Selected** → confirm → rows disappear from inbox
- [ ] **Mark Read** → unread badges clear on selected rows
- [ ] **Mark Unread** → selected rows show unread styling
- [ ] **Cancel** exits edit mode without changes

---

## 3. Conversation management (⋮ or long-press menu)

- [ ] **Pin Conversation** / **Unpin Conversation** — pinned rows stay at top
- [ ] **Mark as Read** — badge clears
- [ ] **Mark as Unread** — badge / bold preview returns
- [ ] **Mute Notifications** / **Unmute** — 🔕 indicator on row
- [ ] **Archive Conversation** — row leaves inbox (reappears on new message)
- [ ] **Delete Conversation** — soft delete for you only

---

## 4. Message-level delete (inside chat)

- [ ] **⋮** or long-press on message → **Delete for me**
- [ ] Own messages also show **Delete for everyone** with confirmation
- [ ] Thread stays stable after deletes

---

## 5. Regression (must still work)

- [ ] Send text message
- [ ] Send photo
- [ ] Receive message (other account)
- [ ] Tab unread badge updates correctly
- [ ] Push / in-app notifications still arrive (muted convos respect mute)
- [ ] Open chat → back to Messages list
- [ ] Favorite training partners section still works
- [ ] Pull to refresh

---

## Sign-off

- [ ] All items pass on iPhone Safari (staging)
- [ ] No console errors during flows
- [ ] Explicit approval to deploy to **production**

**Production URL (do not test delete here until promoted):** https://frennix.vercel.app
