# Security Specification: Comic Studio Database

This document details the security model, invariants, and test payloads mapped to Firestore.

## Collections & Entities

1. `/characters/{characterId}`: Custom characters drawn / managed by users.
2. `/comics/{comicId}`: Comic stories and page structures.

---

## 1. Data Invariants

1. **Ownership Constraint**: A user can only read, write, update, or delete their own characters and comics.
2. **Identification Invariant**: `userId` inside the character and comic documents MUST exactly match `request.auth.uid`.
3. **Data Type Safety**: Comic styles, titles, sound presets, role options, size limits, and ID regex compliance are strictly checked on both creation and update operations.
4. **Immutable Fields**: `id`, `userId`, and `createdAt` are locked post-creation and cannot be spoofed or modified.

---

## 2. Invariants & Validate Payloads

### Expected Safe Playloads

1. **Character Creation**:
   ```json
   {
     "id": "char-123",
     "name": "Super Cap",
     "role": "Hero",
     "description": "Un eroe con grandi poteri",
     "appearance": "Un costume blu d'acciaio con inserti dorati",
     "avatarUrl": "https://images.com/avatar.jpg",
     "accentColor": "#ef4444",
     "userId": "user-valid-123"
   }
   ```

2. **Comic Creation**:
   ```json
   {
     "id": "comic-123",
     "title": "Le avventure di Super Cap",
     "description": "Una storia sul salvataggio della terra",
     "style": "Watercolor",
     "characters": ["char-123"],
     "panels": [],
     "createdAt": "31/05/2026",
     "userId": "user-valid-123"
   }
   ```

---

## 3. The "Dirty Dozen" (Malicious Attacks blocked by Rules)

1. **Identity Spoofing Character**: Authenticated user attempts to write a character document setting `userId` to a victim's user ID. (Blocked: `userId == request.auth.uid`)
2. **Identity Spoofing Comic**: Authenticated user attempts to create a comic setting `userId` to a victim's ID. (Blocked: `userId == request.auth.uid`)
3. **Ghost Fields Injection**: Setting a secret ghost field `isAdmin: true` inside a character profile. (Blocked: `data.keys().hasOnly([...])` strict key checks)
4. **Spoofed Admin Permissions**: Relying on custom admin flags inside a profile during updates. (Blocked: Strict list of updated fields in update logic)
5. **Corrupt Value Types**: Unsigned string or empty descriptions size validation. (Blocked: `.size() > 0` and size caps)
6. **Immutable Fields Change (id)**: Attempting to rewrite the document's unique `id`. (Blocked: `incoming().id == existing().id`)
7. **Immutable Fields Change (userId)**: Attempting to rewrite the owner of a document to transfer ownership. (Blocked: `incoming().userId == existing().userId`)
8. **Malicious Path Injection**: Setting `id` or document index keys to illegal characters `../../../etc/passwd`. (Blocked: `isValidId(id)`)
9. **Denial of Wallet Strings**: Sending multi-megabyte title names. (Blocked: limiting key size `.size() <= 200` on string attributes)
10. **State Corruption (Sound Presets)**: Injecting an unsupported voice or sound engine preset. (Blocked: enum validations strictly verified on `soundEffectPreset`)
11. **Bypassing Verification**: Creating documents under unsigned/unverified emails. (Blocked: requiring `request.auth.token.email_verified == true`)
12. **Foreign Data Scrape**: Performing infinite collection scans without query limit check filters. (Blocked: lists locked strictly to user-filtered queries)
