# Future Account Sync And Multi-User

Status: direction only, not approved for implementation

## Target Direction

- MemoFlow may eventually support many private users.
- Each user should own their own data.
- Each user's data should sync across that user's own devices.
- Users must not see or modify other users' data.

## Current State

- single-user local-first web app
- local file-backed storage
- no auth
- no account model
- no backend sync

## Hard Boundaries For Now

- do not implement auth now
- do not add `user_id` now
- do not implement backend sync now
- do not implement multi-user behavior now

## Required Phase Order

1. Preserve the working local web app.
2. Finish PWA stabilization and basic guardrails.
3. Design account-owned sync.
4. Prototype single-account sync across one user's devices.
5. Revisit hosted multi-user only after single-account sync is proven.

## Design Requirements Later

- canonical data must be owned by the authenticated account
- cross-device sync should use one account-owned source of truth
- authorization must be server-enforced, not client-asserted
- cross-user reads and writes must be blocked by design

## Open Design Questions For Later

- auth method
- server and database shape
- migration path from current local data
- offline behavior and conflict handling
- hosted operations and privacy boundaries
