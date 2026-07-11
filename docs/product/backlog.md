# MemoFlow Backlog

Status: documentation backlog only

## Backlog Process

- Development-time ideas should be captured in backlog.
- Backlog capture does not imply immediate implementation.
- At major decision points, review backlog, reprioritize, and choose the next narrow branch.
- Safety guardrails should be reviewed before integrations or automatic actions.
- One branch should map to one narrow milestone or fix when possible.

## Committed / Next Candidates

### i18n scaffold follow-through

- Status: next-candidate follow-up
- Priority: P1
- Area: i18n, web UI
- Notes: extend the current string scaffold incrementally only where it reduces future translation risk without broad refactor.

### Parser improvement from review-correction logs

- Status: planned loop / evidence-gated follow-up
- Priority: P1 once enough correction records exist
- Area: parser quality, review correction learning, evaluation examples
- Description: after enough review-correction events accumulate, inspect the logs to identify repeated edit patterns. Use those patterns to improve the LLM parser through explicit examples, regression checks, parser rules, or evaluation cases.
- Guardrails:
  - do not automatically mutate parser behavior from individual correction events
  - correction logs are passive learning evidence for now
  - parser improvements should be example-driven
  - only act when enough records or repeated patterns exist
- Possible future milestone:
  - review correction logs
  - summarize recurring edit patterns
  - convert patterns into parser examples and evals
  - update parser behavior deliberately and document the change

## Product Ideas / Explorations

### Reminder support

- Status: product feature idea / possible future milestone
- Priority: P1/P2
- Area: items, time, notifications, review workflow
- Description: explore reminder support for saved items so a user can bring an item back at a future time.
- Possible future shape:
  - add an optional reminder time to an item
  - surface upcoming or overdue reminders in the app
  - later consider browser or PWA notifications if platform support is acceptable
  - keep reminder behavior explicit and user-confirmed
- Questions:
  - is a reminder a property of an item, a separate event, or both
  - should reminders be local-only first
  - how should reminders interact with future Google Calendar integration
  - what are the limitations of iOS PWA notifications
- Not now:
  - do not add reminder fields or notifications in this task
  - do not change storage schema until deliberately designed

### Review description fatigue / default-off descriptions

- Status: product idea / workflow simplification exploration
- Priority: P2
- Area: review workflow, parser output shape, item editing
- Description: item descriptions sometimes make review more exhausting than helpful. Explore whether description should default to empty unless clearly needed.
- Product framing:
  - keep review focused on the smallest useful item payload
  - avoid making users read or edit low-value extra text on every suggestion
  - preserve the option to add a description when it materially helps clarity
- Possible future shape:
  - default to no description for many suggested items
  - only propose descriptions when confidence or usefulness is high
  - make adding or expanding a description explicit during review rather than implicit by default
- Questions:
  - which item categories benefit from description vs title-only review
  - should parser output omit weak descriptions entirely or mark them as optional
  - how should this be evaluated without hiding useful context
- Not now:
  - do not change review UI behavior in this task
  - do not change parser behavior in this task
  - revisit after enough review evidence exists to judge description usefulness

### Voice dump input / wearable capture surface

- Status: product idea / future exploration
- Priority: P2
- Area: capture, mobile, voice input, wearables
- Description: explore a future capture-only surface where users create raw dumps through voice input, especially on phone, Apple Watch, or smart glasses.
- Product framing:
  - capture should be low-friction and ambient
  - review should remain on phone or desktop where editing and judgment are easier
  - voice and wearable input can make MemoFlow more useful as a memory inbox
- Possible future shape:
  - voice dump v0 starts as mobile capture input
  - voice input creates a raw dump, not reviewed items directly
  - user later reviews proposed items on phone or desktop
  - wearable support stays dump-only
  - no wearable review flow initially
- Required boundary before wearable work:
  - define a stable raw-dump creation boundary first
  - keep that boundary narrow and independent from review, parser-learning, or external-action flows
- Keywords / later exploration notes:
  - ASR (automatic speech recognition) for speech-to-text raw-dump capture
  - TTS (text-to-speech) only if a later voice loop or playback flow becomes useful
- Not now:
  - do not implement before the core PWA, mobile, and review flow is stable
  - do not mix with i18n scaffold, parser improvements, or sync work
  - do not implement watch or glasses support until a native shell or sync path exists
  - later decisions are needed on speech-to-text, privacy, offline or online behavior, and platform support

### Google Calendar / Google Workspace integration

- Status: future integration track
- Priority: P2 for now
- Area: external integrations, calendar, Google Workspace, user-confirmed actions
- Description: explore future Google integration starting with a narrow Google Calendar add-event flow. MemoFlow could help convert a reviewed item into a calendar event, but external writes should be explicit and user-confirmed.
- Possible future shape:
  - a reviewed item suggests a calendar event draft
  - the user reviews and confirms
  - the app creates a Google Calendar event only after confirmation
  - later consider broader Google Workspace integrations
- Design principles:
  - start with Calendar before broader Google Workspace
  - prefer draft and confirm flows over automatic writes
  - use explicit permissions and clear user confirmation
  - keep an audit trail of external actions
  - do not let raw dump content directly trigger external writes
- Questions:
  - should the first version export event details manually or use the Google Calendar API
  - how should OAuth or auth be introduced without disrupting local-first behavior
  - how should this relate to future account-owned sync
  - what is the minimum useful calendar action
- Not now:
  - do not add Google OAuth
  - do not add Calendar API calls
  - do not add Gmail or Drive integration
  - do not add backend or sync

## Safety Guardrails

### Input / item injection safety guardrails

- Status: safety/design guardrail
- Priority: P0/P1
- Area: security, LLM parser safety, external action safety, review workflow
- Description: MemoFlow accepts raw user dumps and direct item input. These inputs may contain text that looks like instructions to the LLM or future agents. The app should treat user-provided dump and item content as data, not as trusted instructions.
- Risks to consider:
  - user content telling the LLM to ignore parser instructions
  - user content trying to mutate future parser behavior
  - user content trying to create unauthorized reminders or external actions
  - saved items or memories being treated as higher-priority system instructions
  - future Google Calendar, Gmail, or Drive integrations acting on untrusted content without explicit confirmation
- Design principles:
  - user content is data, not instruction
  - LLM output is suggestion, not authority
  - external writes require explicit user confirmation
  - correction logs are passive evidence and should not automatically mutate parser behavior
  - parser improvements should happen through reviewed rules, examples, and evals, not silent automatic prompt changes
  - future integrations should have clear action boundaries and audit logs
- Possible future milestone:
  - write a short safety model for MemoFlow inputs, parser prompts, saved items, and external actions
  - add prompt boundaries around user-provided content
  - add tests and examples for injection-like dump content
  - ensure future external integrations use confirmation-first flows
- Not now:
  - do not implement a full security framework yet
  - do not block current i18n scaffold work
  - do not add external integrations until this boundary is reviewed

### LLM provider boundary / API-key safety

- Status: safety/design guardrail for friends-alpha
- Priority: P0/P1 before broader alpha sharing
- Area: LLM provider boundary, API-key safety, deployment safety
- Description: future friends/family alpha deployment should keep all LLM provider calls and API keys server-side. The browser should call MemoFlow server routes only, not provider APIs directly.
- Design principles:
  - LLM API keys stay server-side
  - browser/client calls MemoFlow routes, not provider APIs
  - provider choice should be configurable later rather than hardcoded to one provider
  - service worker should not cache user-created parser data or LLM API responses
  - parser failures should be handled gracefully in the UI
- Provider note:
  - future provider choices may include OpenAI, DeepSeek, MiniMax, or others
  - for mainland China testers, more accessible providers may be worth considering later
  - provider selection is a future deployment/configuration decision, not current implementation scope
- Not now:
  - do not implement provider switching in this task
  - do not change parser behavior in this task
  - do not expose provider credentials to client-visible assets

### LLM provider router / aggregator exploration

- Status: future exploration
- Priority: P2
- Area: LLM provider strategy, cost control, mainland China accessibility, parser backend
- Description: explore whether MemoFlow should later support an LLM provider router or aggregator layer that can route parser calls across providers such as OpenAI, DeepSeek, MiniMax, or other compatible APIs. Some services may help use free or low-cost quotas, provide fallback routing, or improve accessibility for testers in different regions.
- Important considerations:
  - do not assume free quotas are stable or production-safe
  - keep provider API keys server-side
  - do not expose provider or router credentials to the browser
  - review privacy implications before sending user dumps through any third-party router
  - check logging and data-retention policies of any router service
  - make provider choice configurable rather than hardcoded
  - parser output quality and schema consistency must be tested per provider
  - avoid making friends-alpha depend on an unstable free-quota setup
- Possible future milestone:
  - compare direct provider calls vs router or aggregator services
  - evaluate cost, reliability, latency, privacy, and China accessibility
  - add provider abstraction only if the product need is clear
- Notes:
  - this is a backlog exploration item only, not current implementation scope

### Simple friends-alpha access code

- Status: safety/planning item for alpha rollout
- Priority: P1 before sharing a public HTTPS PWA link broadly
- Area: alpha access control, abuse prevention, cost protection
- Description: before sharing a public HTTPS PWA link with friends or family, consider a lightweight alpha access code. This is not full auth or multi-user support.
- Goals:
  - prevent accidental link spreading
  - reduce casual abuse
  - protect LLM API costs
  - keep the mechanism small and separate from future account/sync work
- Not now:
  - do not implement full auth here
  - do not merge this with future user/account work
  - do not treat this as multi-user support

### Planning scope note

- Status: backlog note
- Priority: always-on process note
- Area: backlog, safety, alpha rollout
- Notes:
  - these LLM/provider and alpha-access items are backlog and safety-planning items only
  - they do not imply immediate implementation
  - review them before broader alpha rollout or provider/integration changes

## Parking Lot

### User system: account-owned data with per-user device sync

- Status: later-phase product track
- Priority: later
- Area: users, sync, accounts, multi-user
- Description: the current app does not support users. A future user system should let each user's data be shared across that user's own devices, while preventing data from being shared across different users.
- Target model:
  - each user has account-owned data
  - the same user's data syncs across that user's own devices
  - users cannot see or modify other users' data
  - cross-user sharing is not the default model
- Design requirements later:
  - move from the current single shared local store model to per-user ownership
  - use a server-enforced authorization boundary rather than trusting client-provided user identity
  - define how local-first behavior should coexist with account-owned sync
  - keep auditability and isolation clear before broader integrations
- Not now:
  - do not add auth in the current phase
  - do not add `user_id` to the current local data model yet
  - do not implement backend sync in this task
  - do not start hosted multi-user work before narrower single-account sync and safety boundaries are clearer
- Notes: revisit only after single-user UX, i18n groundwork, and narrower integration boundaries are clearer.

### Hosted multi-user product

- Status: later exploration
- Priority: later
- Area: multi-user, hosting, product
- Notes: treat this as a later phase after the user/account model and same-user cross-device sync path are proven.

### Capacitor iOS shell

- Status: later exploration
- Priority: later
- Area: native shell, iOS
- Notes: evaluate only if the browser-installed PWA leaves clear product gaps that the current web shell cannot close cleanly.
