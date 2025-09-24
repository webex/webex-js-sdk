# Complete Ampersand Migration Plan - Comprehensive Analysis

## 🔍 **Current State Analysis**

Based on comprehensive codebase analysis, here are all the remaining Ampersand dependencies that need to be migrated:

### **Critical Core Files Still Using Ampersand**

#### **WebEx-Core Package (High Priority - Partially Migrated)**

- ✅ `packages/@webex/webex-core/src/webex-core.js` - **MIGRATED TO TS**
- ❌ `packages/@webex/webex-core/src/webex-internal-core.js` - **NEEDS MIGRATION**
- ❌ `packages/@webex/webex-core/src/credentials-config.js` - **NEEDS MIGRATION**
- ❌ `packages/@webex/webex-core/src/lib/services/service-catalog.js` - **NEEDS MIGRATION**
- ❌ `packages/@webex/webex-core/src/lib/services/service-url.js` - **NEEDS MIGRATION**
- ❌ `packages/@webex/webex-core/src/lib/credentials/token-collection.js` - **NEEDS MIGRATION**
- ❌ `packages/@webex/webex-core/src/lib/storage/make-webex-store.js` - **NEEDS MIGRATION**
- ❌ `packages/@webex/webex-core/src/plugins/logger.js` - **NEEDS MIGRATION**

#### **Services-v2 (Mixed TypeScript - Needs Cleanup)**

- ❌ `packages/@webex/webex-core/src/lib/services-v2/service-detail.ts` - **USES AmpState**
- ❌ `packages/@webex/webex-core/src/lib/services-v2/service-catalog.ts` - **USES AmpState**

### **Plugin Files Using `.extend()` Pattern**

#### **Major Plugins (Business Logic)**

1. `packages/@webex/plugin-people/src/people.js` - **People management**
2. `packages/@webex/plugin-rooms/src/rooms.js` - **Room management**
3. `packages/@webex/plugin-messages/src/messages.js` - **Message handling**
4. `packages/@webex/plugin-memberships/src/memberships.js` - **Membership management**
5. `packages/@webex/plugin-teams/src/teams.js` - **Team management**
6. `packages/@webex/plugin-team-memberships/src/team-memberships.js` - **Team membership**
7. `packages/@webex/plugin-webhooks/src/webhooks.js` - **Webhook management**
8. `packages/@webex/plugin-attachment-actions/src/attachmentActions.js` - **Attachment actions**

#### **Authorization Plugins**

9. `packages/@webex/plugin-authorization-browser/src/authorization.js`
10. `packages/@webex/plugin-authorization-browser-first-party/src/authorization.js`
11. `packages/@webex/plugin-authorization-node/src/authorization.js`

#### **Internal Core Plugins**

12. `packages/@webex/internal-plugin-encryption/src/encryption.js` - **Security critical**
13. `packages/@webex/internal-plugin-encryption/src/kms.js` - **Key management**
14. `packages/@webex/internal-plugin-device/src/device.js` - **Device management**
15. `packages/@webex/internal-plugin-mercury/src/mercury.js` - **Real-time messaging**
16. `packages/@webex/internal-plugin-metrics/src/metrics.js` - **Analytics**
17. `packages/@webex/internal-plugin-conversation/src/conversation.js` - **Conversation logic**
18. `packages/@webex/internal-plugin-user/src/user.js` - **User management**
19. `packages/@webex/internal-plugin-locus/src/locus.js` - **Meeting coordination**

#### **Secondary Plugins**

20. `packages/@webex/internal-plugin-search/src/search.js`
21. `packages/@webex/internal-plugin-avatar/src/avatar.js`
22. `packages/@webex/internal-plugin-team/src/team.js`
23. `packages/@webex/internal-plugin-ediscovery/src/ediscovery.js`
24. `packages/@webex/internal-plugin-lyra/src/lyra.js`
25. `packages/@webex/internal-plugin-feature/src/feature.js`
26. `packages/@webex/internal-plugin-flag/src/flag.js`
27. `packages/@webex/internal-plugin-calendar/src/calendar.js`
28. `packages/@webex/internal-plugin-presence/src/presence.js`
29. `packages/@webex/internal-plugin-board/src/board.js`
30. `packages/@webex/plugin-device-manager/src/device-manager.js`

### **Batcher Classes Using `.extend()`**

31. `packages/@webex/plugin-people/src/people-batcher.js`
32. `packages/@webex/internal-plugin-encryption/src/kms-batcher.js`
33. `packages/@webex/internal-plugin-avatar/src/avatar-url-batcher.js`
34. `packages/@webex/internal-plugin-metrics/src/batcher.js`
35. `packages/@webex/internal-plugin-metrics/src/client-metrics-batcher.js`
36. `packages/@webex/internal-plugin-user/src/user-uuid-batcher.js`
37. `packages/@webex/internal-plugin-presence/src/presence-batcher.js`

### **TypeScript Files Still Using AmpCollection**

38. `packages/@webex/plugin-meetings/src/breakouts/collection.ts`
39. `packages/@webex/plugin-meetings/src/interpretation/collection.ts`

### **Legacy Device Models (AmpState/AmpCollection)**

40. `packages/@webex/internal-plugin-device/src/features/feature-model.js`
41. `packages/@webex/internal-plugin-device/src/features/features-model.js`
42. `packages/@webex/internal-plugin-device/src/features/feature-collection.js`
43. `packages/@webex/internal-plugin-board/src/realtime-channel-collection.js`

## 🎯 **Migration Strategy & Prioritization**

### **Phase 1: Critical Core Infrastructure (Week 1-2)**

**Goal**: Complete core infrastructure migration to unblock other migrations

1. **webex-internal-core.js** - ⚠️ **HIGHEST PRIORITY**
   - Convert from `AmpState.extend()` to TypeScript class extending `WebexEventEmitter`
   - This is required for many other plugins

2. **credentials-config.js**
   - Convert to TypeScript, use `WebexState` pattern

3. **lib/storage/make-webex-store.js**
   - Replace `ampersand-events` with `WebexEventEmitter`

### **Phase 2: Service & Auth Infrastructure (Week 2-3)**

**Goal**: Migrate service discovery and authentication components

4. **lib/services/service-catalog.js** & **service-url.js**
   - Convert to TypeScript using existing `services.ts` patterns
   - Replace `AmpState` with `WebexState`

5. **lib/credentials/token-collection.js**
   - Convert to TypeScript, use `WebexCollection` pattern

6. **Authorization plugins** (browser, node, first-party)
   - Convert to TypeScript, extend `WebexPlugin`

### **Phase 3: Major Business Logic Plugins (Week 3-5)**

**Goal**: Migrate user-facing functionality

7. **High-Impact Plugins** (order by usage):
   - `plugin-people` (user management)
   - `plugin-rooms` (space management)
   - `plugin-messages` (messaging)
   - `plugin-memberships` (membership management)
   - `plugin-teams` (team management)

8. **Security-Critical Plugins**:
   - `internal-plugin-encryption` (security)
   - `internal-plugin-device` (device management)

### **Phase 4: Real-time & Communication (Week 5-6)**

**Goal**: Migrate real-time communication components

9. **Communication Plugins**:
   - `internal-plugin-mercury` (real-time messaging)
   - `internal-plugin-conversation` (conversation logic)
   - `internal-plugin-locus` (meeting coordination)

### **Phase 5: Supporting Infrastructure (Week 6-7)**

**Goal**: Migrate remaining plugins and batchers

10. **Metrics & Analytics**:
    - `internal-plugin-metrics` and related batchers

11. **Remaining Plugins**:
    - All other `internal-plugin-*` components

### **Phase 6: Collections & Legacy Models (Week 7-8)**

**Goal**: Final cleanup of AmpCollection and legacy models

12. **TypeScript Collections**:
    - `plugin-meetings/src/breakouts/collection.ts`
    - `plugin-meetings/src/interpretation/collection.ts`

13. **Device Models**:
    - All `internal-plugin-device/src/features/*` files

14. **Board Collections**:
    - `internal-plugin-board/src/realtime-channel-collection.js`

## 🔧 **Migration Templates & Patterns**

### **Standard Plugin Migration Pattern**

```typescript
// OLD (Ampersand)
const MyPlugin = WebexPlugin.extend({
  namespace: 'MyPlugin',
  // ... methods
});

// NEW (TypeScript)
export class MyPlugin extends WebexPlugin {
  namespace = 'MyPlugin';
  
  constructor(attrs: any, options: any) {
    super(attrs, options);
  }
  
  // ... methods with proper typing
}
```

### **Batcher Migration Pattern**

```typescript
// OLD (Ampersand)
const MyBatcher = Batcher.extend({
  namespace: 'MyPlugin',
  // ... methods
});

// NEW (TypeScript)
export class MyBatcher extends Batcher {
  namespace = 'MyPlugin';
  
  // ... methods with proper typing
}
```

### **State/Collection Migration Pattern**

```typescript
// OLD (Ampersand)
const MyModel = AmpState.extend({
  // ... properties
});

// NEW (TypeScript)
export class MyModel extends WebexState<MyModelInterface> {
  constructor(attributes: MyModelInterface) {
    super(attributes);
  }
  
  // ... methods with proper typing
}
```

## 📊 **Impact Assessment**

### **High-Risk Files (Breaking Changes Likely)**

- `webex-internal-core.js` - Core infrastructure
- `internal-plugin-encryption/*` - Security critical
- `internal-plugin-device/*` - Device management
- `internal-plugin-mercury.js` - Real-time communication

### **Medium-Risk Files (Moderate Impact)**

- Service & credential management files
- Major business logic plugins (people, rooms, messages)

### **Low-Risk Files (Minimal Impact)**

- Secondary plugins (avatar, search, etc.)
- Test files and utilities

## ✅ **Success Criteria**

1. **Zero `import from 'ampersand-*'` statements** in production code
2. **Zero `.extend()` calls** on Ampersand objects
3. **All plugins extend modern TypeScript base classes**
4. **Full TypeScript compilation** without Ampersand dependencies
5. **All tests passing** after migration
6. **No runtime errors** in production usage

## 🚀 **Next Steps**

1. **Start with Phase 1** - Critical core infrastructure
2. **Test each migration thoroughly** before proceeding
3. **Update imports and dependencies** as files are migrated
4. **Remove Ampersand packages** from package.json once complete
5. **Update documentation** to reflect TypeScript patterns

This plan provides a systematic approach to completely eliminate Ampersand dependencies while minimizing risk and maintaining functionality throughout the migration process.
