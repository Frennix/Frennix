# Friends & Following — Verification Report

## Database Schema

| Table | Purpose |
|-------|---------|
| `friend_requests` | Pending/accepted/declined friend requests (`requester_id`, `recipient_id`, `status`) |
| `friendships` | Canonical undirected friend edges (`user_a < user_b`) |
| `profile_favorites` | Favorited/pinned athlete profiles per user |
| `profiles.state` | State/province for location search |
| `profiles.friend_mode` | `open` or `request_required` |

### Key RPCs

- `send_friend_request`, `respond_friend_request`, `cancel_friend_request`, `remove_friend`, `add_friend_direct`
- `get_friends_page`, `get_friend_requests_page`, `get_mutual_friends_page`
- `get_profile_social_context` — friends count, mutual stats, shared interests/goals, relationship state
- `set_profile_favorite`, `set_profile_favorite_pinned`, `get_favorite_profiles_page`
- `get_people_you_may_know` — scored suggestions
- `get_discover_suggested_sections` — expanded discover rails
- `profile_matches_discover_query` — partial + synonym + trigram search

## New APIs (`packages/api/src/friends.ts`)

- Friend graph: `sendFriendRequest`, `respondFriendRequest`, `cancelFriendRequest`, `removeFriend`, `addFriendDirect`
- Lists: `getFriendsPage`, `getFriendRequestsPage`, `getMutualFriendsPage`, `getPeopleYouMayKnow`
- Profile context: `getProfileSocialContext`, `getFriendCount`
- Favorites: `setProfileFavorite`, `setProfileFavoritePinned`, `getFavoriteProfilesPage`

Extended: `getProfileStats` (friends count), `getDiscoverSuggestedSections` (10 sections), `searchDiscoverProfiles` filters (`trending`, `activeThisWeek`).

## Security / RLS

| Resource | Policy |
|----------|--------|
| `friend_requests` | SELECT/UPDATE: requester or recipient; INSERT: requester only |
| `friendships` | SELECT: either party |
| `profile_favorites` | ALL: owner (`user_id = auth.uid()`) |
| RPCs | `SECURITY DEFINER` with block checks via `users_are_blocked` |

Mutations go through RPCs; direct table writes for friendships are not granted to clients.

## Performance Report

| Area | Approach |
|------|----------|
| Friend/follow lists | Paginated RPCs (`limit` 30, infinite scroll) |
| Profile social context | Single RPC per profile view, `staleTime: 60s` |
| Discover sections | Server-side section RPC, 6 items each, cached by React Query |
| Search | GIN trigram indexes on name/username/city/state; synonym expansion; `duration_ms` in response |
| Optimistic UI | `useFollowUser`, `useFriendUser`, `useProfileFavorite` patch React Query cache |

Expected profile load: 3 parallel queries (profile, stats, social context) — same pattern as before + one lightweight RPC.

## Notifications

| Type | Trigger |
|------|---------|
| `follow` | Existing follow insert |
| `friend_request` | Friend request insert |
| `friend_accepted` | Request accepted |
| `profile_favorited` | Favorite insert |
| `mutual_friend_joined` | New friendship with mutual network overlap |

## UI Surfaces

- Profile: followers/following/**friends** counts, joined date, last active, mutual friends/partners, shared interests/goals
- Actions: Follow, Add Friend, Message, Share, Copy Link, Favorite, Pin, Mute, Report, Block
- Screens: `/friends/[userId]`, `/friend-requests`, `/mutual-friends/[userId]`
- Discover: People You May Know, Trending, Active This Week, Trainers Near You, Recommended, etc.

## Beta Readiness Checklist

- [x] Follow / unfollow (existing)
- [x] Friend requests with optional `request_required` mode
- [x] Accept / decline / remove friends
- [x] Followers / following / friends lists with pagination
- [x] Mutual friends list
- [x] Profile stats (followers, following, friends)
- [x] Enhanced discover search (name, username, city, state, goals, interests, lifestyle keywords, typo tolerance)
- [x] People You May Know scoring
- [x] Discover section rails
- [x] Share / copy link / report / block / mute / favorite / pin
- [x] Social notifications wired
- [x] React Query caching + optimistic updates
- [ ] Apply migration to staging/production Supabase
- [ ] Manual QA: friend request flow end-to-end on device
- [ ] Manual QA: block/mute hides users from suggestions

Run verification: `node scripts/verify-friends-following.mjs`
