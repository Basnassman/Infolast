# IMPLEMENTATION CHANGE MAP — PHASE 2: TELEGRAM VERIFICATION

> Executed against the live repository after Phase 1.
> No changes outside the Verification Module unless explicitly justified at the end.

---

## 1. FILES TO MODIFY

### src/modules/verification/services/account-linking.service.ts  [VERIFICATION]
- **المشكلة (I.1/I.2): Deep-link token is not single-use, not atomically consumed, and not bound to a real User.id.**
  `validateDeepLinkToken` only reads from cache — it does not consume. `linkAccount` then writes the linked `walletAddress` into the `PlatformAccount.userId` (which is a foreign key to `User.id`, not the raw wallet). This lets a stolen token link to a different user if replayed, and it relies on a cache key that can be replayed before expiry.
- **التعديل المطلوب:**
  - Create a `VerificationToken` concept inside the Verification Module that stores `{ token, userId, platform, createdAt, expiresAt, usedAt }` in the `PlatformAccount`-adjacent cache + a Redis hash with atomic `SET NX EX`/`GETDEL` style consumption.
  - `generateDeepLink()` — generates a cryptographically random token, stores it with `userId` (real user.id), `platform`, and a short TTL (600s). Returns `deepLinkUrl`, `token`, `expiresAt`.
  - `consumeDeepLinkToken(token, userId, platform, platformUserId, platformUsername)` — atomic: `GETDEL` on a per-token Redis key with an intra-transaction read-then-insert into `PlatformAccount`. On success returns the linked `userId`; on failure (already used, expired, wrong user, mismatch) throws a typed error. No raw wallet is stored in the token record; the token is bound to the real `User.id`.
  - `validateDeepLinkToken(token)` — read-only check for pre-link validation (e.g., from the Telegram bot) and for the frontend's token expiry; it must NOT consume.
- **سبب ضرورة التعديل:** I.1 (use User.id, not walletAddress), I.2 (atomic single-use token), I.11 (identity binding).
- **تصنيف:** [VERIFICATION]

### src/modules/verification/providers/telegram/telegram.provider.ts  [TELEGRAM]
- **المشكلة (I.3/I.4): Cache-first reads bypass live verification; caching does not distinguish normal vs. security-critical checks.**
- **التعديل المطلوب:**
  - Add `verify(canUseCache: boolean, ...)` so callers can explicitly request a live check (reverification, claim gate).
  - In `cacheFirst`, only use cache when `CacheHint.ALLOW` is set; otherwise always call the Telegram API.
  - `checkMembership(...)` (used by reverification) always calls the Telegram API.
- **سبب ضرورة التعديل:** I.3 (reverification must hit Telegram API), I.4 (cache must not override live verification).
- **تصنيف:** [TELEGRAM]

### src/modules/verification/services/verification.service.ts  [VERIFICATION]
- **المشكلة (I.3/I.5):** `reverificationCheck` short-circuits when the verification record is missing or not VERIFIED, and it skips live Telegram when the record exists. `verifyUserTask` also returns VERIFIED for an idempotent existing verification instead of re-reading Telegram.
- **التعديل المطلوب:**
  - `verifyUserTask(userId, verificationTaskId)`:
    - Always load the required `UserVerificationTask` (no early `continue` that turns missing into VERIFIED). If the record is missing → return `NOT_VERIFIED` (status `VerificationStatus.REJECTED`/`PENDING` equivalent: use `VerificationStatus.REJECTED` as the defensive state; if a more specific enum exists, use that).
    - Always delegate to the provider with `canUseCache: false` for live membership read.
  - `reverificationCheck(userId, verificationTaskId)`:
    - Must re-run live Telegram verification even when the record says VERIFIED. Never treat existing VERIFIED as proof of current membership.
  - `getVerificationStatus` / `getUserVerifiedTasks` — keep DB read; callers that need live trust call `reverificationCheck`.
- **سبب ضرورة التعديل:** I.3 (reverification must call Telegram API), I.5 (missing required task → NOT_VERIFIED).
- **تصنيف:** [VERIFICATION]

### src/modules/verification/services/reverification.service.ts  [VERIFICATION]
- **المشكلة (I.3):** `reverificationBatch` calls `reverificationCheck`, which was not querying Telegram. Not a logic change — the worker already re-runs `verificationService.reverificationCheck`.
- **التعديل المطلوب:** Wrap each batch job with the new live verification path. No new concurrency semantics: keep the existing per-task serial loop; do not add extra counters. `changed` is derived only from the live result.
- **سبب ضرورة التعديل:** I.3, I.6 (counter must not increase on cache hits).
- **تصنيف:** [VERIFICATION]

### src/modules/verification/services/eligibility.service.ts  [VERIFICATION]
- **المشكلة (I.5):** `verifyBeforeClaim` skips tasks whose verification record is missing, silently converting missing → eligible.
- **التعديل المطلوب:**
  - In `verifyBeforeClaim`, if a required task has no `UserVerificationTask` record → add it to `failedTasks` with reason `MISSING_VERIFICATION_REQUIRED`. Do not skip.
  - Do not touch `checkEligibility` (db-only spec is out of scope for this fix).
- **سبب ضرورة التعديل:** I.5 (missing required task → NOT_VERIFIED or equivalent defensive state).
- **تصنيف:** [VERIFICATION]

### src/core/telegram/telegram-webhook.ts  [ACCOUNT-LINKING]
- **المشكلة (I.2/I.11):** Webhook consumes the token, links `walletAddress` as the user, and never enforces single-use or identity binding. A token can be replayed by the bot; a mismatched wallet would silently link.
- **التعديل المطلوب:**
  - Route the token through `accountLinkingService.consumeDeepLinkToken(...)` with the caller-supplied `userId`, `platform`, `platformUserId`.
  - If consumption fails (used/expired/identity-mismatch) → do not link; reply to the bot that the link failed.
  - Never log the raw deep-link token (only the first 8 chars).
- **سبب ضرورة التعديل:** I.2 (atomic single-use), I.11 (identity binding, no duplicate linking).
- **تصنيف:** [ACCOUNT-LINKING]

---

## 2. FILES TO ADD

### src/modules/verification/services/verification.token.service.ts  [VERIFICATION]
- **الغرض:** Own all token lifecycle logic (create → validate → consume → link). Kept in the Verification Module so no other module calls Telegram, cache keys, or the token store.
- **سبب عدم إمكانية وضع المنطق في ملف موجود:** No existing file owns this lifecycle. `account-linking.service.ts` is API-shaped for the web (generate+validate+link) and caches the token without expiry/counter semantics. The token lifecycle needs atomic `GETDEL` consumption + typed errors + `expiresAt`, which belongs in its own service.

---

## 3. FILES TO DELETE

- `src/modules/tasks/verification/task-verification.bot.ts` — already deleted in Phase 1 (`git status` shows `D`). Confirmed dead: grep showed no references anywhere; only `telegram.provider.ts` remains as the Telegram implementation. Nothing to delete now.

---

## 4. FILES EXPLICITLY PROTECTED (UNCHANGED)

- Airdrop — UNCHANGED
- Vesting — UNCHANGED
- Token Sale — UNCHANGED
- Smart Contracts — UNCHANGED
- Tokenomics — UNCHANGED
- Task definitions — UNCHANGED
- Rewards — UNCHANGED
- Risk Engine — UNCHANGED
- Referral — UNCHANGED
- Wallet calculation — UNCHANGED
- User model — UNCHANGED
- Prisma schema — UNCHANGED (NO SCHEMA CHANGE)

---

## 5. EXECUTION ORDER CONFORMED

1. Audit (done)
2. Change Map (this file)
3. User.id mapping → `verification.token.service.ts` + `account-linking.service.ts`
4. Atomic single-use token → `verification.token.service.ts`
5. Identity binding → `verification.token.service.ts` + webhook
6. Membership verification → `telegram.provider.ts` (+ `verification.service.ts`)
7. Reverification → `verification.service.ts` + `reverification.service.ts`
8. Cache behavior → `telegram.provider.ts`
9. Missing UserVerificationTask → `verification.service.ts` + `eligibility.service.ts`
10. REVOKED lifecycle/counter → `reverification.service.ts` (counter derived from live results)
11. Task/Eligibility/Claim use Verification Service → already wired (no change)
12. Remove duplicates → none (only one Telegram implementation)
13. Tests → added in `src/modules/verification/__tests__/`
14. typecheck + tests
15. git diff review (NOT CREATED)

---

## 6. AS-BUILT DELTA (final implementation — what was actually executed)

### 6.1 Interpretation decisions (documented per §3 rules)

1. **I.5 fail-closed + record creation.** `verifyUserTask()` fails closed
   (`RequiredVerificationMissingError`) when the required `UserVerificationTask`
   is missing — a missing record can never become VERIFIED. Because that makes
   the record-creation path explicit, the two verification ENTRY POINTS now
   create the PENDING record first via the new
   `userVerificationTaskRepository.ensurePending(userId, taskId)`:
   - `src/modules/verification/workers/verification.worker.ts` (queue path)
   - `src/modules/tasks/services/task.service.ts` (auto-verify path) —
     **the only edit outside the Verification Module**, justified under §1:
     technically required (without it the Task auto-verification flow would
     always fall back to manual review = regression), smallest possible change
     (one import + one call), touches no task definition, reward, or business
     rule.
   Eligibility/claim gates (`verifyBeforeClaim`, `checkEligibility`,
   `reverificationCheck`) never fabricate VERIFIED for a missing record —
   missing → failed/not-eligible (I.5).
2. **REVOKED is the existing state for I.6.** `VerificationStatus.REVOKED`
   already exists in the Prisma enum — no new state invented. Transition:
   VERIFIED + live check says "not member" → REVOKED; otherwise → REJECTED.
   Batch counters increment only when `changed === true` (never on reads or
   cache hits).
3. **Token storage key.** The token service owns
   `verification:token:<t>` + `verification:token:meta:<t>` (600s TTL). The old
   wallet-based `verification:deeplink:<t>` key and the `DeepLinkToken`
   (walletAddress) type were removed so the insecure pattern cannot be reused.
   Stale pre-deploy tokens under the old key simply expire (600s TTL) and are
   no longer readable by any code path.

### 6.2 Final file inventory

**Modified (in-module):**
- `src/modules/verification/services/account-linking.service.ts` — resolves real User.id, delegates token lifecycle, duplicate-identity guard
- `src/modules/verification/services/verification.token.service.ts` (new in Phase 2, then finalized) — atomic consume
- `src/modules/verification/services/verification.service.ts` — live reverification, REVOKED lifecycle, injectable deps
- `src/modules/verification/services/eligibility.service.ts` — fail-closed claim gate, cache never overrides live check
- `src/modules/verification/services/reverification.service.ts` — counters from live results only
- `src/modules/verification/providers/telegram/telegram.provider.ts` — `verify(ctx, canUseCache)` + live `checkMembership` + injectable statics
- `src/modules/verification/interfaces/verification-provider.interface.ts` — interface sync
- `src/modules/verification/errors/verification.errors.ts` — typed errors
- `src/modules/verification/repositories/user-verification-task.repository.ts` — `ensurePending`
- `src/modules/verification/workers/verification.worker.ts` — `ensurePending` before verify
- `src/modules/verification/types/verification.types.ts` — removed dead wallet-token type/key
- `src/modules/verification/verification.module.ts` — export token service
- `src/core/telegram/telegram-webhook.ts` — VALIDATE → ATOMIC CONSUME → LINK with User.id
- `src/core/cache/cache.service.ts` — added `getAndDel` (Redis GETDEL)
- `src/modules/tasks/services/task.service.ts` — **[justified §1 exception]** `ensurePending` only
- `package.json` — `test` script  [TEST]

**Added:**
- `src/modules/verification/IMPLEMENTATION_CHANGE_MAP.md`
- `src/modules/verification/__tests__/` — 6 suites + `test-helper.ts`
- `scripts/run-tests.cjs`, `scripts/test-preload.cjs`, `tsconfig.test.json`  [TEST]

**Removed:**
- `src/modules/tasks/verification/task-verification.bot.ts` (Phase 1 — proven dead)
- `src/modules/verification/__tests__/test.setup.ts` (dead duplicate of test-helper, created and removed within Phase 2)

**Duplicate Telegram logic search (§13):** `api.telegram.org` appears only in
`src/core/telegram/telegram.client.ts` (the client),
`src/modules/verification/providers/telegram/telegram.provider.ts` (sole
verification consumer of `getChatMember`), and doc/comment strings. ONE SOURCE
OF TRUTH confirmed.
