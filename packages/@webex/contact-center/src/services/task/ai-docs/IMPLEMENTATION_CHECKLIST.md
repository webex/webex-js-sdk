# Implementation Checklist

> **Purpose**: Step-by-step guide for implementing a task management system similar to the contact-center task folder.

---

## Phase 1: Foundation - Type Definitions

### Step 1.1: Define Core Types
- [ ] Create `types.ts` file
- [ ] Define `TaskId` and related identifier types
- [ ] Define `TaskData` interface with all interaction properties
- [ ] Define `TaskResponse` interface for API responses
- [ ] Define `TaskUIControls` interface for UI button states
- [ ] Create media channel enum (`MEDIA_CHANNEL`)
- [ ] Create destination type enum (`DESTINATION_TYPE`)
- [ ] Define all payload interfaces (Transfer, Consult, Wrapup, etc.)

**Validation**: Can import and use types without compilation errors

### Step 1.2: Define Event Types
- [ ] Create `TASK_EVENTS` enum with all lifecycle events
- [ ] Create `CC_EVENTS` enum for backend WebSocket events
- [ ] Define `WebSocketMessage` interface
- [ ] Define `WebSocketPayload` interface

**Validation**: All event types are documented and typed

### Step 1.3: Define Interfaces
- [ ] Create `ITask` interface with all public methods
- [ ] Create channel-specific interfaces (`IVoice`, `IWebRTC`, `IDigital`)
- [ ] Define configuration interfaces (`ConfigFlags`, `WrapupData`)

**Validation**: Interfaces compile and can be implemented

---

## Phase 2: State Machine Implementation

### Step 2.1: Define State Machine Types
- [ ] Create `state-machine/types.ts`
- [ ] Define `TaskContext` interface
- [ ] Define `TaskEventPayload` type
- [ ] Define `UIControlConfig` interface
- [ ] Define `TaskActionsMap` type

**Validation**: XState setup compiles with types

### Step 2.2: Define States and Events
- [ ] Create `state-machine/constants.ts`
- [ ] Define `TaskState` enum with all 9 states
- [ ] Define `TaskEvent` enum with all event types
- [ ] Export state and event constants

**Validation**: All states and events are enumerated

### Step 2.3: Implement Guards
- [ ] Create `state-machine/guards.ts`
- [ ] Implement `isInteractionTerminated` guard
- [ ] Implement `isInteractionConsulting` guard
- [ ] Implement `isInteractionHeld` guard
- [ ] Implement `isInteractionConnected` guard
- [ ] Implement `isConferencingByParticipants` guard
- [ ] Implement `isConsultingAssignment` guard
- [ ] Implement `isConsultInitiator` guard
- [ ] Implement `isConsultedAgent` guard
- [ ] Implement `isLastParticipant` guard
- [ ] Implement `shouldWrapUp` guard
- [ ] Implement all capability guards (canHold, canConsult, etc.)
- [ ] Export guards object with all guard functions

**Validation**: Each guard has unit test, all guards pass

### Step 2.4: Implement Actions
- [ ] Create `state-machine/actions.ts`
- [ ] Implement `createInitialContext` function
- [ ] Implement context update actions (updateTaskData, markHeld, markEnded, etc.)
- [ ] Implement consult tracking actions (setConsultInitiator, setConsultAgentJoined)
- [ ] Implement conference tracking actions (markConferenceStarted)
- [ ] Create action stub functions (actual emissions handled by Task class)
- [ ] Export actions object

**Validation**: Each action updates context correctly

### Step 2.5: Build State Machine Configuration
- [ ] Create `state-machine/TaskStateMachine.ts`
- [ ] Set up XState with proper types
- [ ] Define IDLE state with TASK_INCOMING and HYDRATE transitions
- [ ] Define OFFERED state with ASSIGN, RONA, FAILURE transitions
- [ ] Define CONNECTED state with HOLD, CONSULT, CONFERENCE, END transitions
- [ ] Define HELD state with UNHOLD, CONSULT, END transitions
- [ ] Define CONSULTING state with CONSULT_END, CONFERENCE, TRANSFER transitions
- [ ] Define CONFERENCING state with PARTICIPANT_LEAVE, END transitions
- [ ] Define WRAPPING_UP state with WRAPUP_COMPLETE transition
- [ ] Define WRAPPED_UP state with auto-transition to TERMINATED
- [ ] Define TERMINATED state (terminal)
- [ ] Add global event handlers (CONTACT_UPDATED, RECORDING_STARTED, etc.)
- [ ] Wire up all guards to transitions
- [ ] Wire up all actions to transitions

**Validation**: State machine visualizer shows correct graph, all transitions tested

### Step 2.6: Implement UI Controls Computer
- [ ] Create `state-machine/uiControlsComputer.ts`
- [ ] Implement `getDefaultUIControls` function
- [ ] Implement `computeUIControls` function with switch on state
- [ ] Add logic for OFFERED state controls
- [ ] Add logic for CONNECTED state controls
- [ ] Add logic for HELD state controls
- [ ] Add logic for CONSULTING state controls
- [ ] Add logic for CONFERENCING state controls
- [ ] Add logic for WRAPPING_UP state controls
- [ ] Implement helper functions (canPauseRecording, canEndConsult, etc.)
- [ ] Implement `haveUIControlsChanged` function for change detection

**Validation**: UI controls computed correctly for all state/context combinations

---

## Phase 3: AQM Integration Layer

### Step 3.1: Implement Contact Service
- [ ] Create `contact.ts`
- [ ] Create `routingContact` function accepting AqmReqs
- [ ] Implement `accept` request builder
- [ ] Implement `hold` request builder
- [ ] Implement `unhold` request builder
- [ ] Implement `pauseRecording` request builder
- [ ] Implement `resumeRecording` request builder
- [ ] Implement `consult` request builder (with queue timeout handling)
- [ ] Implement `consultEnd` request builder
- [ ] Implement `consultAccept` request builder
- [ ] Implement `blindTransfer` request builder
- [ ] Implement `vteamTransfer` request builder
- [ ] Implement `consultTransfer` request builder
- [ ] Implement `consultConference` request builder
- [ ] Implement `exitConference` request builder
- [ ] Implement `conferenceTransfer` request builder
- [ ] Implement `end` request builder
- [ ] Implement `wrapup` request builder
- [ ] Implement `cancelTask` request builder
- [ ] Implement `cancelCtq` request builder
- [ ] Map success/failure events for each operation

**Validation**: Each request builder returns correct config object

### Step 3.2: Implement Dialer Service
- [ ] Create `dialer.ts`
- [ ] Create `aqmDialer` function accepting AqmReqs
- [ ] Implement `startOutdial` request builder
- [ ] Map success event (`AGENT_OFFER_CONTACT`)
- [ ] Map failure event (`AGENT_OUTBOUND_FAILED`)

**Validation**: Outdial request builder returns correct config

### Step 3.3: Create Constants
- [ ] Create `constants.ts`
- [ ] Define `METHODS` constants for logging
- [ ] Define API endpoint constants if needed
- [ ] Define timeout constants

**Validation**: All constants are defined and exported

---

## Phase 4: Core Task Classes

### Step 4.1: Implement Abstract Task Class
- [ ] Create `Task.ts`
- [ ] Extend EventEmitter
- [ ] Define protected properties (contact, metricsManager, data, etc.)
- [ ] Define public properties (stateMachineService, state, uiControls)
- [ ] Implement constructor with state machine initialization
- [ ] Implement `initializeStateMachine` method
- [ ] Implement `sendStateMachineEvent` method
- [ ] Implement `getCurrentState` method
- [ ] Implement `computeUIControls` method
- [ ] Implement `updateUiControls` method
- [ ] Implement `getStateMachineActionOverrides` method
- [ ] Implement `getCommonActionOverrides` with all emissions
- [ ] Implement `getChannelSpecificActionOverrides` (empty, for override)
- [ ] Implement `createEmitSelfAction` helper
- [ ] Implement `updateTaskData` with reconciliation
- [ ] Implement `reconcileData` for deep merge
- [ ] Implement abstract `accept` method
- [ ] Implement default (unsupported) voice methods
- [ ] Implement `transfer` method
- [ ] Implement `end` method
- [ ] Implement `wrapup` method with validation
- [ ] Implement `setupAutoWrapupTimer` method
- [ ] Implement `cancelAutoWrapupTimer` method
- [ ] Implement `autoAnswerIfNeeded` method
- [ ] Implement `unsupportedMethodError` helper
- [ ] Implement `uiControls` getter
- [ ] Add metrics tracking to all operations
- [ ] Add error handling with getErrorDetails

**Validation**: Task class compiles, all methods have correct signatures

### Step 4.2: Implement Voice Class
- [ ] Create `voice/Voice.ts`
- [ ] Extend Task class
- [ ] Override `accept` with unsupported error (PSTN auto-answers)
- [ ] Override `decline` with unsupported error
- [ ] Implement `holdResume` method
- [ ] Implement `hold` method (delegates to holdResume)
- [ ] Implement `resume` method (delegates to holdResume)
- [ ] Implement `pauseRecording` method
- [ ] Implement `resumeRecording` method
- [ ] Implement `consult` method
- [ ] Implement `endConsult` method
- [ ] Implement `consultTransfer` method
- [ ] Implement `consultConference` method
- [ ] Implement `exitConference` method
- [ ] Implement `transferConference` method
- [ ] Add voice-specific action overrides
- [ ] Add metrics tracking

**Validation**: Voice task handles all voice-specific operations

### Step 4.3: Implement WebRTC Class
- [ ] Create `voice/WebRTC.ts`
- [ ] Extend Voice class
- [ ] Add localAudioStream property
- [ ] Add webCallingService property
- [ ] Override `accept` to answer WebCalling call first
- [ ] Override `decline` to decline WebCalling call
- [ ] Implement `toggleMute` method
- [ ] Implement `switchCall` method
- [ ] Implement `registerWebCallListeners` method
- [ ] Override `unregisterWebCallListeners` method
- [ ] Handle REMOTE_MEDIA event to emit TASK_MEDIA
- [ ] Handle call state events
- [ ] Override action overrides for WebRTC-specific flow

**Validation**: WebRTC task integrates with WebCalling SDK correctly

### Step 4.4: Implement Digital Class
- [ ] Create `digital/Digital.ts`
- [ ] Extend Task class
- [ ] Implement `accept` method (direct AQM call)
- [ ] Override `updateTaskData` to handle digital-specific updates
- [ ] Override action overrides for digital-specific flow

**Validation**: Digital task handles chat/email/social interactions

### Step 4.5: Implement AutoWrapup Class
- [ ] Create `AutoWrapup.ts`
- [ ] Implement timer property
- [ ] Implement duration property
- [ ] Implement allowCancel property
- [ ] Implement `start` method with callback
- [ ] Implement `clear` method to cancel timer
- [ ] Implement `extend` method (if needed)

**Validation**: Auto-wrapup timer fires callback after duration

---

## Phase 5: Task Factory

### Step 5.1: Implement Factory
- [ ] Create `TaskFactory.ts`
- [ ] Implement static `createTask` method
- [ ] Add logic to resolve media type from TaskData
- [ ] Add switch statement on media type
- [ ] Return WebRTC instance for TELEPHONY + BROWSER login
- [ ] Return Voice instance for TELEPHONY + EXTENSION/DN login
- [ ] Return Digital instance for CHAT/EMAIL/SOCIAL
- [ ] Throw error for unknown media types
- [ ] Pass all dependencies to constructors

**Validation**: Factory creates correct task type for all scenarios

---

## Phase 6: Task Manager

### Step 6.1: Implement Core TaskManager
- [ ] Create `TaskManager.ts`
- [ ] Extend EventEmitter
- [ ] Add static singleton instance property
- [ ] Add taskCollection property (Record<TaskId, ITask>)
- [ ] Implement private constructor
- [ ] Implement static `getTaskManager` method (singleton)
- [ ] Implement `setConfigFlags` method
- [ ] Implement `setWrapupData` method
- [ ] Implement `setAgentId` method
- [ ] Implement `getAgentId` method
- [ ] Implement `setWebRtcEnabled` method
- [ ] Implement `getTask` method
- [ ] Implement `getAllTasks` method

**Validation**: TaskManager singleton works correctly

### Step 6.2: Implement Event Mapping
- [ ] Implement static `mapEventToTaskStateMachineEvent` method
- [ ] Add mapping for all CC_EVENTS to TaskEvent
- [ ] Extract mediaResourceId from various payload locations
- [ ] Handle special cases (consult flags, wrapup logic, etc.)
- [ ] Return null for events without mappings

**Validation**: All backend events map to correct TaskEvent

### Step 6.3: Implement WebSocket Handling
- [ ] Implement `registerTaskListeners` method
- [ ] Implement static `parseWebSocketMessage` method
- [ ] Filter out keepalive messages
- [ ] Normalize task data
- [ ] Implement `prepareEventContext` method
- [ ] Validate event type (isCcEvent check)
- [ ] Compute wrapUpRequired logic for transfers
- [ ] Implement `handleTaskLifecycleEvent` method
- [ ] Delegate to specific handlers by event type

**Validation**: WebSocket messages processed correctly through pipeline

### Step 6.4: Implement Task Lifecycle Handlers
- [ ] Implement `handleContactReserved` method (create task)
- [ ] Determine if task is consulted
- [ ] Determine if should auto-answer
- [ ] Create task via factory
- [ ] Add to taskCollection
- [ ] Call setupTaskListeners
- [ ] Implement `handleAgentContact` method (hydrate/create)
- [ ] Check if task exists, create if missing
- [ ] Set wrapUpRequired from participants
- [ ] Set isConferenceInProgress flag
- [ ] Implement `handleContactMergedEvent` method
- [ ] Remove child task from collection
- [ ] Update or create parent task
- [ ] Emit TASK_MERGED event

**Validation**: Tasks created/updated correctly for each event type

### Step 6.5: Implement Task Event Bubbling
- [ ] Implement `setupTaskListeners` method
- [ ] Listen to TASK_INCOMING, re-emit on TaskManager
- [ ] Listen to TASK_HYDRATE, re-emit on TaskManager
- [ ] Listen to TASK_CLEANUP, handle cleanup logic
- [ ] Listen to TASK_MERGED, re-emit on TaskManager

**Validation**: Task events bubble up to TaskManager and consumers

### Step 6.6: Implement Cleanup Logic
- [ ] Implement `handleTaskCleanup` method
- [ ] Handle WebRTC call cleanup
- [ ] Determine if task should be removed from collection
- [ ] Check outdial + wrapup logic
- [ ] Check secondary EPDN agent logic
- [ ] Implement `removeTaskFromCollection` method
- [ ] Cancel auto-wrapup timer
- [ ] Delete from taskCollection
- [ ] Log removal

**Validation**: Tasks cleaned up appropriately

### Step 6.7: Implement WebRTC Call Integration
- [ ] Implement `handleIncomingWebCall` method
- [ ] Find telephony task in collection
- [ ] Map call ID to task interaction ID
- [ ] Send TASK_INCOMING event to state machine
- [ ] Store call reference
- [ ] Implement `registerIncomingCallEvent` method
- [ ] Implement `unregisterIncomingCallEvent` method

**Validation**: WebRTC calls mapped to tasks correctly

### Step 6.8: Implement Data Update
- [ ] Implement `updateTaskData` method
- [ ] Validate task exists
- [ ] Call task.updateTaskData
- [ ] Update taskCollection reference

**Validation**: Task data updates propagate correctly

---

## Phase 7: Utility Functions

### Step 7.1: Implement TaskUtils
- [ ] Create `TaskUtils.ts`
- [ ] Implement `shouldAutoAnswerTask` function
- [ ] Implement `getIsConferenceInProgress` function
- [ ] Implement `isSecondaryEpDnAgent` function
- [ ] Implement `isPrimary` function
- [ ] Implement `isParticipantInMainInteraction` function
- [ ] Implement other helper functions as needed

**Validation**: Each utility function has unit test

### Step 7.2: Implement Data Normalizer
- [ ] Create `taskDataNormalizer.ts`
- [ ] Implement `normalizeTaskData` function
- [ ] Handle missing fields
- [ ] Set defaults
- [ ] Transform data structures if needed

**Validation**: Normalized data has consistent shape

---

## Phase 8: Integration Testing

### Step 8.1: End-to-End Flow Tests
- [ ] Test incoming call flow (WebSocket → Task creation → Accept → Connected)
- [ ] Test hold/resume flow
- [ ] Test consult flow (initiate → active → end)
- [ ] Test consult transfer flow
- [ ] Test conference flow
- [ ] Test transfer flow
- [ ] Test wrapup flow
- [ ] Test outdial flow
- [ ] Test HYDRATE state restoration
- [ ] Test multi-session scenarios

**Validation**: All flows work end-to-end

### Step 8.2: Error Handling Tests
- [ ] Test network errors
- [ ] Test invalid state transitions
- [ ] Test missing parameters
- [ ] Test timeout scenarios
- [ ] Test backend errors

**Validation**: Errors handled gracefully

### Step 8.3: Edge Cases
- [ ] Test rapid state changes
- [ ] Test concurrent operations
- [ ] Test task cleanup edge cases
- [ ] Test WebRTC call mapping edge cases
- [ ] Test EPDN transfer scenarios

**Validation**: Edge cases handled correctly

---

## Phase 9: Documentation

### Step 9.1: Code Documentation
- [ ] Add JSDoc comments to all public methods
- [ ] Add inline comments for complex logic
- [ ] Document state machine transitions
- [ ] Document guard conditions
- [ ] Document action side effects

**Validation**: All public APIs documented

### Step 9.2: Architecture Documentation
- [ ] Create ARCHITECTURE.md
- [ ] Create AGENTS.md for usage guide
- [ ] Document class hierarchy
- [ ] Document event flows
- [ ] Document integration points
- [ ] Create sequence diagrams
- [ ] Create state diagrams

**Validation**: Documentation is complete and accurate

---

## Phase 10: Performance & Optimization

### Step 10.1: Performance Testing
- [ ] Test with 100+ concurrent tasks
- [ ] Test rapid task creation/destruction
- [ ] Test memory leaks (event listener cleanup)
- [ ] Profile state machine transitions
- [ ] Profile UI controls computation

**Validation**: Performance meets requirements

### Step 10.2: Optimizations
- [ ] Optimize UI controls change detection
- [ ] Optimize state machine event processing
- [ ] Add caching where appropriate
- [ ] Minimize re-renders/re-computations
- [ ] Optimize WebSocket message parsing

**Validation**: Performance improved

---

## Phase 11: Production Readiness

### Step 11.1: Logging
- [ ] Add structured logging to all operations
- [ ] Log state transitions
- [ ] Log API calls
- [ ] Log errors with context
- [ ] Use LoggerProxy pattern

**Validation**: Logs are useful for debugging

### Step 11.2: Metrics
- [ ] Track task lifecycle events
- [ ] Track operation success/failure rates
- [ ] Track operation latency
- [ ] Track state distribution
- [ ] Track error types

**Validation**: Metrics provide operational visibility

### Step 11.3: Error Recovery
- [ ] Implement retry logic for transient failures
- [ ] Implement circuit breaker pattern
- [ ] Implement fallback behaviors
- [ ] Implement graceful degradation

**Validation**: System recovers from failures

---

## Completion Criteria

- [ ] All unit tests pass (>90% coverage)
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No memory leaks detected
- [ ] Performance benchmarks met
- [ ] All documentation complete
- [ ] Code review approved
- [ ] Security review passed
- [ ] Accessibility requirements met
- [ ] Production deployment successful

---

## Estimated Timeline

| Phase | Estimated Duration |
|-------|-------------------|
| Phase 1: Foundation | 1-2 days |
| Phase 2: State Machine | 3-5 days |
| Phase 3: AQM Integration | 2-3 days |
| Phase 4: Core Task Classes | 4-6 days |
| Phase 5: Task Factory | 0.5 day |
| Phase 6: Task Manager | 3-5 days |
| Phase 7: Utility Functions | 1-2 days |
| Phase 8: Integration Testing | 3-5 days |
| Phase 9: Documentation | 2-3 days |
| Phase 10: Performance | 2-3 days |
| Phase 11: Production Readiness | 2-3 days |
| **Total** | **23-37 days** |

---

## Related Files

- [1_TYPES.md](./1_TYPES.md) - Type definitions reference
- [2_STATE_MACHINE.md](./2_STATE_MACHINE.md) - State machine specification
- [3_API_METHODS.md](./3_API_METHODS.md) - API methods reference
- [4_ARCHITECTURE_PATTERNS.md](./4_ARCHITECTURE_PATTERNS.md) - Design patterns
- [5_INTEGRATION.md](./5_INTEGRATION.md) - Integration guide
- [7_TESTING.md](./7_TESTING.md) - Testing strategy
