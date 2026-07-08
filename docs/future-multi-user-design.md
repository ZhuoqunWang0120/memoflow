# Future Multi-User Design

## Purpose

MemoFlow is currently a single-user product. This document records the intended
future direction for multi-user support after the single-user PWA experience is
tested and stabilized.

This is a design note only. It is not approved for implementation yet.

## Current State

- single-user local-first app
- file-backed storage
- no auth
- no user/account model
- one shared store per running server instance

Today, if multiple devices connect to the same running MemoFlow server, they see
the same shared records because the server reads and writes one shared store.

## Deferred Decision

Multi-user support is intentionally postponed until:

- the current user tests the PWA behavior on real devices
- core capture, memory, pending-review, and item-edit flows are stable
- the single-user behavior worth preserving is clear

The current PWA phase should remain focused on validating the single-user
product rather than mixing product iteration with auth and backend redesign.

## Near-Term Sequencing

The next implementation target is single-user phone-and-laptop sync, not
multi-user auth or per-user backend architecture.

Near-term plan:

- validate the current PWA on real devices first
- improve same-user phone+laptop access by pointing both devices at one running
  MemoFlow server and one canonical store
- avoid building per-device merge or client-side sync logic

This single-user sync step is temporary product infrastructure, not the future
multi-user architecture. The long-term direction remains one authenticated
server-side source of truth per user.

## Future Target Model

- each user has private records
- the same user should see the same items, memory, and dumps on laptop and phone
- users should not see each other's data
- same-account multi-device access must use one server-backed source of truth,
  not separate local stores on each device

## Required Architecture Changes

- add a user/account model
- add authentication, with email magic link as the current preferred direction
- move canonical persistence from shared JSONL files to server-owned per-user
  persistence
- scope every item, memory, and dump query by authenticated user
- migrate existing single-user local data into one initial user account when
  implementation begins

## Recommended Storage And Auth Direction

- small backend is acceptable
- preferred first implementation: app server plus relational database
- preferred auth direction: email magic link
- do not use client-supplied `user_id`
- do not attempt multi-user by sharing one JSONL file across users

## Non-Goals For The Current PWA Phase

- no auth implementation
- no user schema changes
- no backend migration yet
- no multi-user implementation yet
- no team/shared workspace features
- no offline sync/conflict resolution system

## Recommended Implementation Order Later

1. Finish single-user PWA testing and iteration.
2. Implement and validate single-user phone+laptop sync against one shared server/store.
3. Freeze single-user behavior after that sync flow is stable.
4. Add a storage/repository boundary if the current code needs separation.
5. Add auth and session handling.
6. Add per-user persistence.
7. Migrate existing local data into an initial user account.
8. Verify same-user cross-device behavior on laptop and phone under the user model.
