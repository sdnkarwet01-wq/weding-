# WEDLINK Security Specification

## 1. Data Invariants
1. **User PII Isolation**: `/users/{userId}` contains `email` and profile info; `get`, `create`, `update`, and `delete` are strictly limited to `request.auth.uid == userId` with verified email (`request.auth.token.email_verified == true`), and `list` is permanently denied (`if false`).
2. **Invitation Ownership & Draft Secrecy**: `/invitations/{invitationId}` can only be created, updated, or deleted by its verified `ownerId == request.auth.uid`. Draft invitations (`status == 'draft'`) can ONLY be read by their owner; public guests can only read `status == 'published'` invitations.
3. **Unique Slug Ownership**: `/slugs/{slug}` prevents slug hijacking. Creating a slug requires `!exists(/databases/.../slugs/$(slug))`, `ownerId == request.auth.uid`, and `invitationId` matching an invitation owned by `request.auth.uid`.
4. **Private Guest Lists**: `/guests/{guestId}` contains invitee names and personalized tokens. `get`, `list`, `create`, `update`, and `delete` are strictly restricted to `ownerId == request.auth.uid` (verified) and parent invitation ownership via `get()`.
5. **Unauthenticated RSVP & Wishes Gate**: Guests may submit `/rsvps/{rsvpId}` and `/wishes/{wishId}` without logging in ONLY if the referenced `invitationId` exists, has `status == 'published'`, and `ownerId` matches the parent invitation's `ownerId`. `rsvps` are readable only by the invitation owner; `wishes` with `isVisible == true` are readable on published invitations.
6. **Temporal & Schema Integrity**: Every `createdAt` must equal `request.time` on creation and remain immutable on update. Every string and array enforces strict `.size()` boundaries.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Cross-User Profile Read**: User B attempts `get(/users/userA)`.
2. **User Collection Enumeration**: Any user attempts `list(/users)`.
3. **Owner Spoofing on Invitation Create**: User A sets `ownerId: "userB"` when creating `/invitations/inv1`.
4. **Draft Invitation Leak**: Anonymous guest or User B attempts `get(/invitations/draftInv)` or `list(/invitations)` without `status == 'published'` filter.
5. **Shadow Field Injection**: Owner sends `isAdmin: true` or `tier: "enterprise"` on `/invitations/inv1` create/update.
6. **Slug Hijacking**: User B attempts to overwrite `/slugs/aditya-nabila` owned by User A.
7. **Cross-User Guest Scraping**: User B runs `list(/guests)` or `get(/guests/guestA)` owned by User A.
8. **Orphaned RSVP Submission**: Guest submits `/rsvps/r1` referencing a non-existent or `'draft'` `invitationId`.
9. **RSVP Owner Forgery**: Guest submits `/rsvps/r1` for User A's published invitation while setting `ownerId: "attackerUid"` so attacker can read the RSVP list.
10. **Wish Payload Bomb**: Guest submits a `/wishes/w1` with a 5,000-character message (`> 500` limit) or `guestName` of 0 chars.
11. **Immutable `createdAt` Tampering**: Owner attempts to backdate `createdAt` during an invitation `update`.
12. **Path ID Poisoning**: Attacker attempts to create `/invitations/invalid$id!with/junk` violating `^[a-zA-Z0-9_-]+$`.
