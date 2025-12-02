# Webex Core Package Technical Documentation

## Table of Contents

- [Overview](#overview)
- [Architecture Overview](#architecture-overview)
- [Core Components](#core-components)
- [Webex Object Creation Process](#webex-object-creation-process)
- [Plugin System Architecture](#plugin-system-architecture)
- [HTTP Request Pipeline](#http-request-pipeline)
- [Storage System](#storage-system)
- [Configuration Management](#configuration-management)
- [Event System](#event-system)
- [Detailed Code Flow Analysis](#detailed-code-flow-analysis)

## Overview

The Webex Core package (`@webex/webex-core`) serves as the foundational infrastructure for the Webex JavaScript SDK. It provides the basic framework for plugin registration, HTTP request handling, authentication, storage management, and event-driven architecture that all other Webex SDK functionality builds upon.

This technical documentation provides a comprehensive overview of the Webex Core package infrastructure, explaining the foundational systems that enable the entire Webex JavaScript SDK ecosystem. The architecture demonstrates a well-designed separation of concerns with clear plugin boundaries, robust HTTP handling, and flexible configuration management.

## Architecture Overview

The Webex Core follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│              Webex SDK                  │
│  (Public API - webex/src/webex.js)     │
├─────────────────────────────────────────┤
│            Plugin Layer                 │
│  - Public Plugins (meetings, people)   │
│  - Internal Plugins (device, mercury)  │
├─────────────────────────────────────────┤
│           Webex Core Layer              │
│  - HTTP Pipeline & Interceptors         │
│  - Authentication & Credentials         │
│  - Storage Management                   │
│  - Configuration System                 │
├─────────────────────────────────────────┤
│          Foundation Layer               │
│  - AmpersandState (State Management)    │
│  - EventEmitter (Event System)          │
│  - HTTP Core (Network Layer)            │
└─────────────────────────────────────────┘
```

## Core Components

### 1. WebexCore Class (`webex-core.js`)

**Primary Functions:**

- `constructor()` - Initializes WebexCore with credential normalization
- `initialize()` - Sets up configuration, interceptors, and event listeners
- `refresh()` - Delegates to credentials.refresh() for token refresh
- `transform()` - Applies payload transformations bidirectionally
- `applyNamedTransform()` - Applies specific transform by name
- `getWindow()` - Returns browser window object
- `setConfig()` - Updates configuration dynamically
- `bearerValidator()` - Validates and corrects access token format
- `inspect()` - Provides debug representation
- `logout()` - Orchestrates complete logout process
- `measure()` - Sends metrics via metrics plugin
- `upload()` - Handles file uploads with three-phase process
- `_uploadPhaseInitialize()` - Initiates upload session
- `_uploadPhaseUpload()` - Performs actual file upload
- `_uploadPhaseFinalize()` - Completes upload session
- `_uploadAbortSession()` - Aborts upload if size limit exceeded
- `_uploadApplySession()` - Applies session configuration

**Derived Properties:**

- `boundedStorage` - Storage with size limits
- `unboundedStorage` - Unlimited storage
- `ready` - Indicates all plugins are initialized

**Session Properties:**

- `config` - Configuration object
- `loaded` - Initial load completion status
- `request` - HTTP request function
- `sessionId` - Unique session identifier

### 2. WebexInternalCore Class (`webex-internal-core.js`)

**Primary Functions:**

- `inspect()` - Debug representation of internal plugins

**Derived Properties:**

- `ready` - Aggregates readiness of all internal plugins

### 3. WebexPlugin Base Class (`lib/webex-plugin.js`)

**Primary Functions:**

- `initialize()` - Plugin initialization with datatype binding
- `clear()` - Clears plugin state while preserving parent reference
- `inspect()` - Debug representation
- `request()` - Delegates to webex.request()
- `upload()` - Delegates to webex.upload()
- `when()` - Promise-based event waiting
- `_filterSetParameters()` - Normalizes set() parameters

**Derived Properties:**

- `boundedStorage` - Plugin-specific bounded storage
- `unboundedStorage` - Plugin-specific unbounded storage
- `config` - Plugin-specific configuration
- `logger` - Plugin-specific logger
- `webex` - Reference to root Webex instance

**Session Properties:**

- `parent` - Parent object reference
- `ready` - Plugin readiness status

## Webex Object Creation Process

### Step 1: Entry Point (`webex/src/webex.js`)

**Function: `Webex.init(attrs)`**

1. Merges default configuration with provided attributes
2. Sets `sdkType: 'webex'` in configuration
3. Creates new Webex instance by extending WebexCore
4. Automatically requires all public plugins:
   - `@webex/plugin-authorization`
   - `@webex/plugin-meetings`
   - `@webex/plugin-people`
   - `@webex/plugin-rooms`
   - `@webex/plugin-messages`
   - And many others...

### Step 2: WebexCore Construction

**Function: `WebexCore.constructor(attrs, options)`**

1. **Credential Normalization**: Handles various token input formats
   - String tokens converted to credential objects
   - Multiple token path variations normalized
   - Bearer token validation and correction via `bearerValidator()`

2. **AmpersandState Initialization**: Calls parent constructor

### Step 3: WebexCore Initialization

**Function: `WebexCore.initialize(attrs)`**

1. **Configuration Merge**: Combines default config with provided attributes
2. **Event Setup**: Establishes loaded/ready event handlers
3. **Child Event Propagation**: Sets up nested event bubbling
4. **Interceptor Chain Setup**: Builds HTTP request interceptor pipeline
5. **Request Function Creation**: Creates configured request function
6. **Session ID Generation**: Creates unique tracking ID

### Step 4: Plugin Registration and Initialization

**Function: `mixinWebexCorePlugins()` and `mixinWebexInternalCorePlugins()`**

1. **Plugin Registration**: Each plugin registers via `registerPlugin()`
2. **Child Relationship**: Plugins added to `_children` collection
3. **Proxy Creation**: Public API methods proxied if specified
4. **Configuration Merge**: Plugin configs merged into main config
5. **Interceptor Registration**: Plugin interceptors added to pipeline

## Plugin System Architecture

### Plugin Registration Process

**Function: `registerPlugin(name, constructor, options)`**

**Registration Options:**

- `proxies` - Array of methods to proxy to root level
- `interceptors` - HTTP interceptors to add to pipeline
- `config` - Configuration to merge
- `payloadTransformer.predicates` - Transform predicates
- `payloadTransformer.transforms` - Transform functions
- `onBeforeLogout` - Cleanup handlers for logout

**Plugin Types:**

1. **Public Plugins**: Registered on WebexCore directly
2. **Internal Plugins**: Registered on WebexInternalCore

### Plugin Lifecycle

1. **Registration**: Plugin constructor added to `_children`
2. **Instantiation**: AmpersandState creates plugin instances
3. **Initialization**: Plugin `initialize()` method called
4. **Configuration**: Plugin receives namespace-specific config
5. **Ready State**: Plugin sets `ready` property when initialized

### Example Plugin Structure (People Plugin)

**Class: `People extends WebexPlugin`**

- `namespace: 'People'` - Configuration namespace
- `children: { batcher: PeopleBatcher }` - Sub-components
- `get(person)` - Retrieve person by ID
- `list(options)` - List people with filters
- `inferPersonIdFromUuid(id)` - UUID to Hydra ID conversion
- `_getMe()` - Fetch current user (@oneFlight decorated)

## HTTP Request Pipeline

### Interceptor Chain Architecture

**Interceptor Order:**

1. **Pre-Interceptors**: Run before main processing
   - `ResponseLoggerInterceptor`
   - `RequestTimingInterceptor`
   - `RequestEventInterceptor`
   - `WebexTrackingIdInterceptor`
   - `RateLimitInterceptor`

2. **Core Interceptors**: Main request processing
   - `ServiceInterceptor`
   - `UserAgentInterceptor`
   - `WebexUserAgentInterceptor`
   - `AuthInterceptor`
   - `PayloadTransformerInterceptor`
   - `RedirectInterceptor`

3. **Post-Interceptors**: Run after main processing
   - `HttpStatusInterceptor`
   - `NetworkTimingInterceptor`
   - `EmbargoInterceptor`
   - `RequestLoggerInterceptor`
   - `RateLimitInterceptor`

### Key Interceptors

**AuthInterceptor (`interceptors/auth.js`):**

- `onRequest()` - Adds authorization headers
- `requiresCredentials()` - Determines if auth is needed
- `onResponseError()` - Handles 401 responses
- `shouldAttemptReauth()` - Decides on token refresh
- `replay()` - Retries failed requests after refresh

**RequestTimingInterceptor:**

- Measures request duration
- Adds timing metadata

**PayloadTransformerInterceptor:**

- Applies bidirectional data transformations
- Handles encryption/decryption

## Storage System

### Storage Architecture

**Functions:**

- `makeWebexStore(type, webex)` - Creates storage instance
- `makeWebexPluginStore(type, plugin)` - Creates plugin-specific storage

**Storage Types:**

1. **Bounded Storage**: Size-limited, typically for frequently accessed data
2. **Unbounded Storage**: No size limits, for archival data

**Default Adapters:**

- `MemoryStoreAdapter` - In-memory storage (default)
- `LocalStorageAdapter` - Browser localStorage
- `SessionStorageAdapter` - Browser sessionStorage

**Storage Methods:**

- `get(key)` - Retrieve value
- `set(key, value)` - Store value
- `del(key)` - Delete value
- `clear()` - Clear all values

## Configuration Management

### Configuration Sources

**File: `config.js`**

- Default configuration values
- Service discovery URLs
- Storage adapter configuration
- Interceptor settings
- Security settings

**Key Configuration Sections:**

- `maxAppLevelRedirects: 10`
- `maxLocusRedirects: 5`
- `maxAuthenticationReplays: 1`
- `services.discovery` - Service discovery URLs
- `services.validateDomains` - Domain validation settings
- `storage` - Storage adapter configuration
- `payloadTransformer` - Transform configuration

**Configuration Merge Process:**

1. Default config loaded from `config.js`
2. Plugin configs merged during registration
3. User-provided config merged during initialization
4. Runtime config updates via `setConfig()`

## Event System

### Event Architecture

**Base Events (WebexCore):**

- `loaded` - Data loaded from storage
- `ready` - All plugins initialized
- `change:config` - Configuration changed
- `client:logout` - Logout completed

**Event Propagation:**

- Child events bubble to parent with namespace prefix
- Example: `change:people` when People plugin changes

**Event Methods:**

- `trigger(event, ...args)` - Emit event
- `listenTo(target, event, handler)` - Listen to target's events
- `listenToAndRun(target, event, handler)` - Listen and run immediately
- `stopListening(target, event, handler)` - Stop listening
- `when(event)` - Promise-based event waiting

### Plugin Event Handling

**Lifecycle Events:**

- Plugins emit `change` events on state changes
- Parent automatically propagates child events
- Ready state changes trigger parent ready recalculation

## Detailed Code Flow Analysis

### Webex Object Creation Flow

1. **Entry**: `Webex.init({credentials: 'token'})`
2. **Config Merge**: Default + user config merged
3. **Constructor**: WebexCore constructor called
4. **Token Normalization**: Various token formats standardized
5. **AmpersandState Init**: Base state management initialized
6. **WebexCore Init**: Core initialization begins
7. **Config Setup**: Final config object created
8. **Event Handlers**: Ready/loaded event handlers established
9. **Interceptor Chain**: HTTP interceptor pipeline built
10. **Request Function**: Configured request function created
11. **Session ID**: Unique session identifier generated
12. **Plugin Loading**: All registered plugins instantiated
13. **Plugin Init**: Each plugin's initialize() called
14. **Ready State**: System ready when all plugins ready

### HTTP Request Flow

1. **Request Initiated**: `webex.request(options)` called
2. **Pre-Interceptors**: Logging, timing, tracking setup
3. **Auth Interceptor**: Authorization header added if needed
4. **Service Interceptor**: Service URL resolution
5. **Payload Transform**: Request data transformation
6. **HTTP Core**: Actual HTTP request execution
7. **Response Processing**: Status, timing, logging
8. **Error Handling**: 401 handling, token refresh, retry
9. **Response Transform**: Response data transformation
10. **Result Return**: Final response returned to caller

### Plugin Method Invocation Flow

1. **Method Call**: `webex.people.get('personId')`
2. **Plugin Resolution**: WebexCore resolves 'people' child
3. **Method Execution**: People.get() method called
4. **Request Delegation**: Plugin calls `this.request()`
5. **Core Request**: Delegates to webex.request()
6. **Interceptor Pipeline**: Full HTTP pipeline executed
7. **Response Processing**: Plugin processes response
8. **Result Return**: Processed result returned to caller

### Storage Operation Flow

1. **Storage Access**: `webex.boundedStorage.get('key')`
2. **Adapter Resolution**: Storage adapter determined
3. **Key Namespacing**: Key prefixed with namespace
4. **Adapter Method**: Actual storage operation performed
5. **Result Processing**: Raw result processed if needed
6. **Return**: Final value returned to caller

This technical documentation provides a comprehensive overview of the Webex Core package infrastructure, explaining the foundational systems that enable the entire Webex JavaScript SDK ecosystem. The architecture demonstrates a well-designed separation of concerns with clear plugin boundaries, robust HTTP handling, and flexible configuration management.
