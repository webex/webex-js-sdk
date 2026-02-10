# SDK Plugin Patterns - Contact Center SDK

> **Purpose**: Patterns for extending WebexPlugin and integrating with the Webex SDK.

---

## WebexPlugin Extension

### Base Class

```typescript
import {WebexPlugin} from '@webex/webex-core';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  // Namespace for accessing via webex.cc
  namespace = 'cc';
  
  // SDK references (use $ prefix)
  private $webex: WebexSDK;
  private $config: CCPluginConfig;
  
  // Internal state
  private eventEmitter: EventEmitter;
  private agentConfig: Profile;
  private services: Services;
  
  constructor(...args) {
    super(...args);
    
    // Initialize EventEmitter
    this.eventEmitter = new EventEmitter();
    
    // Get webex reference
    // @ts-ignore - accessing parent property
    this.$webex = this.webex;
    
    // Wait for SDK ready
    this.$webex.once(READY, () => {
      // @ts-ignore - accessing config
      this.$config = this.config;
      
      // Initialize services
      this.initializeServices();
    });
  }
}
```

### Plugin Registration

The plugin is registered via the SDK's plugin system. Configuration in `src/config.ts`:

```typescript
// src/config.ts
export default {
  cc: {
    force: true,
    isKeepAliveEnabled: false,
    clientType: 'WebexCCSDK',
    allowMultiLogin: true,
    allowAutomatedRelogin: true,
  },
};
```

---

## Initialization Pattern

### Ready Event Handling

```typescript
constructor(...args) {
  super(...args);
  
  this.$webex.once(READY, () => {
    // 1. Store config reference
    this.$config = this.config;
    
    // 2. Initialize singleton services
    this.webexRequest = WebexRequest.getInstance({
      webex: this.$webex,
    });
    
    this.services = Services.getInstance({
      webex: this.$webex,
      connectionConfig: this.getConnectionConfig(),
    });
    
    this.metricsManager = MetricsManager.getInstance({
      webex: this.$webex,
    });
    
    // 3. Setup event listeners
    this.services.webSocketManager.on('message', this.handleWebsocketMessage);
    
    // 4. Initialize sub-services
    this.webCallingService = new WebCallingService(this.$webex);
    this.taskManager = TaskManager.getTaskManager(
      this.services.contact,
      this.webCallingService,
      this.services.webSocketManager
    );
    
    // 5. Initialize API instances
    this.entryPoint = new EntryPoint(this.$webex);
    this.addressBook = new AddressBook(this.$webex, () => this.agentConfig?.addressBookId);
    this.queue = new Queue(this.$webex);
    
    // 6. Initialize logger
    LoggerProxy.initialize(this.$webex.logger);
  });
}
```

---

## Public API Method Pattern

### Standard Method Template

```typescript
/**
 * Description of the method.
 *
 * @param {ParamType} data - Description of parameters
 * @returns {Promise<ReturnType>} Description of return value
 * @throws {Error} When operation fails
 *
 * @public
 *
 * @example
 * ```typescript
 * const result = await cc.methodName({
 *   param: 'value',
 * });
 * ```
 */
public async methodName(data: ParamType): Promise<ReturnType> {
  // 1. Log start
  LoggerProxy.info('Starting operation', {
    module: CC_FILE,
    method: METHODS.METHOD_NAME,
  });
  
  try {
    // 2. Start timing metrics
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.OPERATION_SUCCESS,
      METRIC_EVENT_NAMES.OPERATION_FAILED,
    ]);
    
    // 3. Validate input if needed
    if (!this.validateInput(data)) {
      throw new Error('Invalid input');
    }
    
    // 4. Perform operation
    const result = await this.services.someService.method({data});
    
    // 5. Track success metrics
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.OPERATION_SUCCESS,
      {
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        // Add operation-specific fields
      },
      ['behavioral', 'operational']
    );
    
    // 6. Log success
    LoggerProxy.log('Operation completed successfully', {
      module: CC_FILE,
      method: METHODS.METHOD_NAME,
      trackingId: result.trackingId,
    });
    
    // 7. Return result
    return result;
    
  } catch (error) {
    // 8. Handle error
    const failure = error.details as Failure;
    
    // 9. Track failure metrics
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.OPERATION_FAILED,
      {
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
      },
      ['behavioral', 'operational']
    );
    
    // 10. Get detailed error (logs automatically)
    const {error: detailedError} = getErrorDetails(
      error,
      METHODS.METHOD_NAME,
      CC_FILE
    );
    
    // 11. Throw augmented error
    throw detailedError;
  }
}
```

---

## Event Emission

### Using WebexPlugin emit

```typescript
// Emit event to subscribers
// @ts-ignore - WebexPlugin emit signature
this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData);
```

### Using trigger (alternative)

```typescript
// Some events use trigger
// @ts-ignore
this.trigger(TASK_EVENTS.TASK_INCOMING, task);
```

### Event Handler Pattern

```typescript
// Arrow function for consistent `this` binding
private handleIncomingTask = (task: ITask) => {
  // @ts-ignore
  this.trigger(TASK_EVENTS.TASK_INCOMING, task);
};

// Register in constructor
this.taskManager.on(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);

// Cleanup in deregister
this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
```

---

## Configuration Access

### Getting Config

```typescript
private getConnectionConfig(): SubscribeRequest {
  return {
    force: this.$config?.force ?? true,
    isKeepAliveEnabled: this.$config?.isKeepAliveEnabled ?? false,
    clientType: this.$config?.clientType ?? 'WebexCCSDK',
    allowMultiLogin: this.$config?.allowMultiLogin ?? true,
  };
}
```

### Accessing Credentials

```typescript
const orgId = this.$webex.credentials.getOrgId();
```

---

## Services Singleton Pattern

### Services Class

```typescript
// services/index.ts
export default class Services {
  public readonly agent: ReturnType<typeof routingAgent>;
  public readonly config: AgentConfigService;
  public readonly contact: ReturnType<typeof routingContact>;
  public readonly dialer: ReturnType<typeof aqmDialer>;
  public readonly webSocketManager: WebSocketManager;
  public readonly connectionService: ConnectionService;
  
  private static instance: Services;
  
  constructor(options: {webex: WebexSDK; connectionConfig: SubscribeRequest}) {
    const {webex, connectionConfig} = options;
    
    this.webSocketManager = new WebSocketManager({webex});
    const aqmReq = new AqmReqs(this.webSocketManager);
    
    this.config = new AgentConfigService();
    this.agent = routingAgent(aqmReq);
    this.contact = routingContact(aqmReq);
    this.dialer = aqmDialer(aqmReq);
    this.connectionService = new ConnectionService({
      webSocketManager: this.webSocketManager,
      subscribeRequest: connectionConfig,
    });
  }
  
  public static getInstance(options: {...}): Services {
    if (!this.instance) {
      this.instance = new Services(options);
    }
    return this.instance;
  }
}
```

### Usage in Plugin

```typescript
// Access services
await this.services.agent.stationLogin({data});
await this.services.config.getAgentConfig(orgId, agentId);
this.services.webSocketManager.on('message', handler);
```

---

## Cleanup Pattern

### Deregister Method

```typescript
public async deregister(): Promise<void> {
  try {
    // 1. Start timing
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS,
      METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
    ]);
    
    // 2. Remove task manager listeners
    this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
    this.taskManager.off(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);
    this.taskManager.unregisterIncomingCallEvent();
    
    // 3. Remove WebSocket listeners
    this.services.webSocketManager.off('message', this.handleWebsocketMessage);
    this.services.connectionService.off('connectionLost', this.handleConnectionLost);
    
    // 4. Disconnect Mercury if needed
    if (this.agentConfig.webRtcEnabled && 
        this.agentConfig.loginVoiceOptions.includes(LoginOption.BROWSER)) {
      if (this.$webex.internal.mercury.connected) {
        this.$webex.internal.mercury.off('online');
        this.$webex.internal.mercury.off('offline');
        await this.$webex.internal.mercury.disconnect();
        await this.$webex.internal.device.unregister();
      }
    }
    
    // 5. Close WebSocket
    if (!this.services.webSocketManager.isSocketClosed) {
      this.services.webSocketManager.close(false, 'Unregistering the SDK');
    }
    
    // 6. Clear state
    this.agentConfig = null;
    
    // 7. Log and track success
    LoggerProxy.log('Deregistered successfully', {
      module: CC_FILE,
      method: METHODS.DEREGISTER,
    });
    
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS,
      {},
      ['operational']
    );
    
  } catch (error) {
    // Handle error
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
      {error: error.message},
      ['operational']
    );
    throw error;
  }
}
```

---

## Data Service Pattern

### Standalone Service Class

```typescript
// services/AddressBook.ts
export default class AddressBook {
  private webex: WebexSDK;
  private getAddressBookId: () => string | undefined;
  
  constructor(webex: WebexSDK, getAddressBookId: () => string | undefined) {
    this.webex = webex;
    this.getAddressBookId = getAddressBookId;
  }
  
  public async getEntries(params: SearchParams): Promise<EntriesResponse> {
    const addressBookId = this.getAddressBookId();
    
    if (!addressBookId) {
      throw new Error('Address book ID not available');
    }
    
    const response = await this.webex.request({
      method: 'GET',
      uri: `${API_ENDPOINT}/address-books/${addressBookId}/entries`,
      qs: params,
    });
    
    return response.body;
  }
}
```

### Exposing in Plugin

```typescript
// In cc.ts
public addressBook: AddressBook;

constructor(...args) {
  this.$webex.once(READY, () => {
    this.addressBook = new AddressBook(
      this.$webex,
      () => this.agentConfig?.addressBookId
    );
  });
}
```

---

## TypeScript Considerations

### Suppressing Type Errors

```typescript
// When accessing WebexPlugin internals
// @ts-ignore
this.$webex = this.webex;

// @ts-ignore
this.$config = this.config;

// When emitting events
// @ts-ignore
this.emit(eventName, data);

// @ts-ignore
this.trigger(eventName, data);
```

### Interface Implementation

```typescript
export default class ContactCenter 
  extends WebexPlugin 
  implements IContactCenter {
  // Must implement all IContactCenter methods
}
```
