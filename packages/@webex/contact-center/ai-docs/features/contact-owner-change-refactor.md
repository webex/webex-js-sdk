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
| Resolve one unique related task using nested interaction IDs, the collection key, or the `mainCall` media-map key | Some supported owner-change payloads identify the surviving call through a child top-level ID and omit `mainInteractionId`. | Preserves cross-channel promotion across the documented payload variants. Task aliases are deduplicated and ambiguous matches remain ignored. |
| Accept current-Agent main-leg evidence from the existing task or authoritative incoming promotion | A local child task can be briefly stale when the owner-change payload first proves promotion. | Preserves the stale-snapshot fix while continuing to reject ordinary consult-only tasks. |
| Recover a missing promoted-Agent task from a complete `ContactOwnerChanged` payload | Reloaded or desynchronized clients may receive the authoritative promotion before normal task creation catches up. Agent Desktop supports the same recovery path. | A complete telephony main-leg payload restores the task under the stable main interaction ID, emits one `task:hydrate`, and emits no synthetic `task:incoming`. |
| Preserve a confirmed owner across a late `ParticipantLeftConference` snapshot that still names the departed owner | Participant Drop can deliver owner change and participant-left notifications in either order. | Prevents the Primary UI from reverting after it has already received the authoritative new owner. |

## Refactoring and safety constraints

Owner-change correlation and recovery retain the following protections:

- generic lifecycle-event correlation is unchanged; collection-key and media-key
  matching are enabled only for `ContactOwnerChanged`;
- only a task selected by the related-interaction fallback may be re-keyed;
- conflicting task/payload main IDs are ignored;
- a stable main key already owned by a different Task causes the event to be
  ignored; and
- an exact child task is never normalized over a distinct main task;
- aliases of the same Task object are deduplicated before uniqueness is tested;
- consult-only and ambiguous matches are rejected; and
- missing-task recovery is rejected whenever any related task or canonical-key
  occupant already exists.

This closes the PR review scenario where an exact child task could previously
be normalized to a main key and silently replace the actual main Task, orphaning
its listeners and resources.

Recovery is intentionally narrow. It requires a non-terminal telephony payload,
`interaction.owner` equal to the current Agent, an active participant entry for
that Agent on an `mType: mainCall` leg, and a stable main interaction ID. It does
not use `toOwner`, elect an owner locally, or create a task for a missing
owner-changing `ContactUpdated` event.

## Resulting event flow

1. The backend chooses the new `interaction.owner`.
2. The promoted Agent receives `ContactOwnerChanged`; other surviving Agents may
   receive an owner-changing `ContactUpdated`.
3. TaskManager first uses an exact task match and otherwise accepts one unique,
   eligible related task.
4. If the promoted Agent has no related task, a complete authoritative payload
   may recover the task under its stable main interaction ID. An internal
   pre-listener `HYDRATE` restores the actor state without publishing an event.
5. Both notification forms use the existing `CONTACT_OWNER_CHANGED` state-machine
   event.
6. The state machine updates task/context data, keeps the current task state, and
   emits exactly one public `task:hydrate`.
7. Widget consumers receive the hydrated Task and render the backend-provided
   owner immediately.

`ParticipantLeftConference` continues through its existing event/state-machine
path. No client elects a successor and no Drop completion fabricates an owner.

## Verification coverage

The focused TaskManager tests cover owner-changing versus data-only
`ContactUpdated`, exact and child-keyed correlation, collection-key and
`mainCall` media-key payloads, stale incoming promotion evidence, consult-only
and ambiguous rejection, narrow missing-task recovery, listener/alias safety,
later `AgentContact` and `ContactMerged` reuse, exact-child/main-task collision
protection, and both owner-change/participant-left orders.
