# MemoFlow Roadmap

Status: post-PWA v0 planning only

## Principles

- Preserve the working local web app first.
- Keep single-user local-first behavior until a later approved architecture change.
- Add guardrails before broader surface-area changes.
- Treat account sync and multi-user as separate later phases.

## Sequence

1. Preserve working local web app
   - Goal: keep current local behavior stable while planning next steps.
   - Exit criteria: docs stay ahead of code changes; regression checks stay runnable.

2. iOS PWA v0
   - Status: done.
   - Exit criteria: installable baseline exists and current core flows still work.

3. Smoke/regression guardrails
   - Goal: protect `/`, `/capture`, item flows, and review flows from basic breakage.
   - Exit criteria: a small repeatable check suite runs before UI changes.

4. Mobile layout polish
   - Goal: remove narrow-screen friction without changing product behavior.
   - Exit criteria: iPhone-width screens stay readable and safe-area clean.

5. Parser quality loop
   - Status: deferred to a later explicit loop after alpha groundwork.
   - Goal: review parser mistakes systematically before changing parser logic.
   - Exit criteria: corrections are logged, triaged, and turned into explicit backlog items.

6. i18n scaffold
   - Status: done.
   - Goal: prepare string organization and locale boundaries without shipping translated UI yet.
   - Exit criteria: user-facing strings can be moved out of inline English safely.

7. Friends-alpha safety checks
   - Goal: tighten pre-alpha safety boundaries before broader external testing.
   - Scope:
     - data isolation
     - LLM provider/API-key boundary
     - simple alpha access code
   - Exit criteria: the alpha-sharing boundary is documented and the highest-risk safety gaps are understood.

8. Capacitor iOS shell
   - Goal: run a narrow iOS shell spike early enough to discover native/TestFlight blockers.
   - Scope:
     - build iOS app
     - install locally
     - document blockers
   - Exit criteria: the team understands the minimal wrapper architecture and the main Xcode/signing risks.

9. Chinese UI v0
   - Goal: ship a first Chinese UI pass after the scaffold is ready.
   - Exit criteria: core UI strings have Chinese coverage for the main single-user flows.

10. TestFlight alpha
   - Goal: get a limited native alpha into testers' hands after the iOS shell spike is understood.
   - Exit criteria: blockers, signing requirements, and tester-distribution steps are clear enough for a narrow alpha.

11. Parser quality loop from correction logs
   - Goal: review accumulated correction evidence and improve the parser deliberately through examples/evals.
   - Exit criteria: repeated correction patterns have been converted into explicit parser-quality changes or evals.

## Not Now

- No auth implementation now.
- No `user_id` added to the current local data model now.
- No backend sync implementation now.
- No multi-user product implementation now.
