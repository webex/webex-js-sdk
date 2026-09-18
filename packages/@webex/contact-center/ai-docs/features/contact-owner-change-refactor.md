# Contact Owner Change Refactor

## Scope

This change refactors only the owner-change propagation introduced by
webex-js-sdk PR #5187. It preserves the behavior required by Participant Drop:
when the backend promotes a new primary Agent, existing SDK tasks publish the
updated owner through the existing `task:hydrate` event so widgets immediately
recompute the Primary label, icon, and Drop permission.

There is no public API, routing-event, state-machine transition, Participant
Drop request, or widget contract change.

## Retained behavior

| Behavior | Why it remains | Existing-flow impact |
|---|---|---|
| Map an owner-changing `ContactUpdated` to `CONTACT_OWNER_CHANGED` | Remaining conference Agents receive `ContactUpdated`, not necessarily `ContactOwnerChanged`. The existing state-machine action synchronizes task data and emits `task:hydrate`. | Preserves immediate owner/Primary UI updates without adding a new public event or state transition. Same-owner and owner-less updates remain data-only. |
| Resolve `ContactOwnerChanged` by exact ID before related IDs | Exact identity remains the safest and existing lookup contract. | Existing exact task routing is unchanged. |
| Resolve one unique child/main-related task through explicit nested interaction IDs | The promoted Agent can receive a child top-level ID while nested `interactionId`/`mainInteractionId` identify the surviving main task. | Preserves cross-channel promotion without guessing from collection keys or media-map keys. Ambiguous matches remain ignored. |
| Accept current-Agent main-leg evidence from the existing task or authoritative incoming promotion | A local child task can be briefly stale when the owner-change payload first proves promotion. | Preserves the stale-snapshot fix while continuing to reject ordinary consult-only tasks. |
| Preserve a confirmed owner across a late `ParticipantLeftConference` snapshot that still names the departed owner | Participant Drop can deliver owner change and participant-left notifications in either order. | Prevents the Primary UI from reverting after it has already received the authoritative new owner. |

## Removed behavior

| Removed code or behavior | Why it was removed | Existing-flow impact |
|---|---|---|
| `handleContactOwnerChanged()` missing-task creation | Reconstructing a Task from a single owner-change notification is reload/desynchronization recovery, not part of normal Participant Drop. It duplicated TaskFactory, hydration, listener, and state restoration responsibilities. | No impact when a conference task already exists, which is the Drop flow. If an isolated owner-change arrives with no SDK task, it is now ignored; normal task creation/recovery remains owned by `AgentContact` and `ContactMerged`. |
| `canRecoverTaskFromContactOwnerChanged()` and recovery-only normalization | These helpers existed only to support the removed missing-task path. | Removes no behavior from an existing task. |
| Internal pre-listener `HYDRATE` followed by owner-change replay | This two-event sequence existed only for the synthetic recovered task. | Existing tasks still receive exactly one owner-change event and one public `task:hydrate`. |
| `findTaskForContactOwnerChange()` wrapper and separate `findRelatedTasks()` abstraction | The same result is expressed directly through the existing unique-related-task helper with a narrow eligibility predicate. | Keeps exact, unique, and ambiguous lookup outcomes while reducing duplicate lookup code. |
| Collection-key and `mainCall` media-map-key correlation | Observed owner-change payloads provide explicit nested main/parent identifiers. Broad key guessing increased accidental-match risk and was only needed by defensive recovery tests. | Normal exact and explicit child/main correlation remains intact. Payloads with only a media-map key and no explicit related identifier are intentionally not correlated. |
| Recovery-only unit tests | Their production behavior no longer exists. | Focused tests remain for the supported existing-task contract. |

## Added safety

Owner-change correlation now validates the stable main interaction before any
canonical re-keying:

- only a task selected by the related-interaction fallback may be re-keyed;
- conflicting task/payload main IDs are ignored;
- a stable main key already owned by a different Task causes the event to be
  ignored; and
- a same-object alias at that key remains safe and is deduplicated by the
  existing `updateTaskData()` path.

This closes the PR review scenario where an exact child task could previously
be normalized to a main key and silently replace the actual main Task, orphaning
its listeners and resources.

## Resulting event flow

1. The backend chooses the new `interaction.owner`.
2. The promoted Agent receives `ContactOwnerChanged`; other surviving Agents may
   receive an owner-changing `ContactUpdated`.
3. TaskManager correlates an existing exact or unique related task.
4. Both notification forms use the existing `CONTACT_OWNER_CHANGED` state-machine
   event.
5. The state machine updates task/context data, keeps the current task state, and
   emits `task:hydrate`.
6. Widget consumers receive the hydrated Task and render the backend-provided
   owner immediately.

`ParticipantLeftConference` continues through its existing event/state-machine
path. No client elects a successor and no Drop completion fabricates an owner.

## Verification coverage

The focused TaskManager tests cover owner-changing versus data-only
`ContactUpdated`, exact and child-keyed correlation, stale incoming promotion
evidence, consult-only and ambiguous rejection, missing-task non-creation,
exact-child/main-task collision protection, and both owner-change/participant-left
orders.
