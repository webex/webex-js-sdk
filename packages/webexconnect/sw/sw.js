// importScripts('./assets/js/mqttws31.js'); //disable before distribution

// Parse SW config from the script URL query string (synchronous, available at top-level
// before any Firebase or storage init). The page-side SDK builds this URL when calling
// navigator.serviceWorker.register().
let _swCfg = null;
try {
    const _params = new URLSearchParams(self.location.search);
    const _raw = _params.get('cfg');
    if (!_raw) throw new Error('SW registered without cfg query param');
    _swCfg = JSON.parse(atob(decodeURIComponent(_raw)));
    if (!_swCfg.appId) {
        throw new Error('SW cfg missing required fields : appid');
    }
} catch (e) {
    console.error('[SW] Failed to parse cfg from URL:', e);
}

self.swAppId = _swCfg ? _swCfg.appId : null;
self._swServerUrl = _swCfg ? _swCfg.serverUrl : null;

self._appClientMap = new Map();
if (self.clients && typeof self.clients.matchAll === 'function') {
  self._originalMatchAll = self.clients.matchAll.bind(self.clients);
  self.clients.matchAll = async function(options) {
    if (self._appClientMapReady) await self._appClientMapReady;
    const allClients = await self._originalMatchAll(options);
    const activeClientIds = new Set(allClients.map(function(c) { return c.id; }));
    let pruned = false;
    for (const [clientId] of self._appClientMap) {
      if (!activeClientIds.has(clientId)) {
        self._appClientMap.delete(clientId);
        pruned = true;
      }
    }
    if (pruned && self._saveAppClientMap) self._saveAppClientMap();

    return allClients.filter(function(client) {
      const registeredAppId = self._appClientMap.get(client.id);
      return registeredAppId === self.swAppId;
    });
  };
} else {
  console.warn('[SW] sw.js loaded outside a ServiceWorker context (self.clients unavailable) - skipping clients.matchAll override. The script should only be loaded via navigator.serviceWorker.register(), not as a page <script>.');
}

function _hasUsableFirebaseConfig(cfg) {
    return !!(cfg && cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId);
}

var messaging = undefined;
if (_swCfg && _hasUsableFirebaseConfig(_swCfg.firebaseConfig)) {
    try {
        importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js');
        importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js');

        firebase.initializeApp(_swCfg.firebaseConfig);
        messaging = firebase.messaging();
    } catch (e) {
        console.error('[SW] Firebase init failed; continuing without push:', e);
        messaging = undefined;
    }
}

const SDK_API_LEVEL = 1;
const ERROR_API_LEVEL_NOT_SUPPORTED = 84;
const DB_KEY_CONNECTED_WINDOW_CLIENTS = "connectedWindowClients";
const DB_KEY_APP_CLIENT_MAP = "appClientMap";
const ICErrorCodes = {
    InvalidToken: { code: 6027, description: "Invalid token" },
    TokenExpired: { code: 6029, description: "Token is expired" },
    TokenRequired: { code: 6030, description: "Token is required" },
};

const CODE_SUCCESS = 0;

self.defaultFetchOptions = { headers: { apilevel: SDK_API_LEVEL } };
self.mqttClient;
self.connectedWindowClientIds = [];
self.addEventListener('install', ev => {
    self.skipWaiting();
});
self.addEventListener('activate', async ev => {
    ev.waitUntil(async () => {
        self.clients.claim();
    });
});

class StoreIndexDB {
    constructor(appId) {
        this.dbName = `IMI.Background.${appId}`;
        this.storeName = 'keyValueStore';
        this.isInitialized = false;

        const request = indexedDB.open(this.dbName, 1);

        this.ready = new Promise((resolve, reject) => {
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isInitialized = true;
                resolve();
            };

            request.onerror = (event) => {
                console.error('IndexedDB initialization failed:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    assertIsInitialized() {
        if (!this.isInitialized) throw "Store not initialized!";
    }

    set(key, value) {
        this.assertIsInitialized();
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.put({ key, value });
    }

    async has(key) {
        this.assertIsInitialized();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? true : false);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    remove(key) {
        this.assertIsInitialized();
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.delete(key);
    }

    async get(key) {
        this.assertIsInitialized();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }
}
class StoreCaches {
    constructor(appId) {
        this.isInitialized = false;
        this.ready = caches.open(`IMI.Background.${appId}`).then((cache) => {
            this.isInitialized = true;
            this.store = cache;
        });
    }
    assertIsInitialized() {
        if (!this.isInitialized) throw "Store not initialized!"
    }
    set(key, value) {
        this.assertIsInitialized();
        const jsonResponse = new Response(JSON.stringify(value));
        this.store.put(key, jsonResponse);
    }
    async has(key) {
        this.assertIsInitialized();
        return await this.store.match(key);
    }
    remove(id) {
        this.assertIsInitialized();
        this.store.delete(id);
    }
    async get(id) {
        let val = await this.has(id);
        if (!val) return null;
        const text = await val.text();
        if (text === '') return null;
        try {
            return JSON.parse(text);
        } catch (e) {
            return text;
        }
    }
}
let Store = StoreCaches;

self.db = new Store(self.swAppId);
self.idbStorage = new StoreIndexDB(self.swAppId);

self._saveAppClientMap = async function () {
    await self.idbStorage.ready;
    if (!self._originalMatchAll) return;
    const allClients = await self._originalMatchAll({ includeUncontrolled: true });
    const aliveIds = new Set(allClients.map(c => c.id));
    for (const [clientId] of self._appClientMap) {
        if (!aliveIds.has(clientId)) {
            self._appClientMap.delete(clientId);
        }
    }
    const entries = [...self._appClientMap.entries()];
    self.idbStorage.set(DB_KEY_APP_CLIENT_MAP, entries);
};
self._loadAppClientMap = async function () {
    await self.idbStorage.ready;
    const entries = await self.idbStorage.get(DB_KEY_APP_CLIENT_MAP);
    if (entries && Array.isArray(entries)) {
        for (const [k, v] of entries) {
            if (!self._appClientMap.has(k)) self._appClientMap.set(k, v);
        }
    }
};
self._appClientMapReady = self._loadAppClientMap();

var EventType = {
    DeviceRegistered: "deviceRegistered",
    DeviceUnregistered: "deviceUnregistered",
    UserIdUpdated: "userIdUpdated",
    StartMessageDeliveryStatusRetry: "startMessageDeliveryStatusRetry",
    ShouldDisplayNotification: 'shouldDisplayNotification',
    UpdateAjaxHeaders: "updateAjaxHeaders",
    AddRetryRequest: "addRetryRequest",
    Startup: "startup",
    Shutdown: "shutdown",
    RequestConnection: "requestConnection",
    RequestDisconnection: "requestDisconnection",
    ConnectionEstablished: "connectionEstablished",
    ConnectionLost: "connectionLost",
    ConnectionFailure: "connectionFailure",
    MessageArrived: "messageArrived",
    RepublishLocally: "republishLocally",
    LocalMessageRepublished: "localMessageRepublished",
    SendDeliveryReceipt: "sendDeliveryReceipt",
    Reconnect: "reconnect",
    RegisterAppClient: "REGISTER_APP_CLIENT",
    DeregisterAppClient: "DEREGISTER_APP_CLIENT",
    SwPing: "SW_PING",
    SwPong: "SW_PONG"
}

self.addEventListener("message", async (event) => {
    if (event.data && event.data.type === EventType.RegisterAppClient) {
        self._appClientMap.set(event.source.id, event.data.appId);
        self._saveAppClientMap();
        return;
    }
    if (event.data && event.data.type === EventType.DeregisterAppClient) {
        self._appClientMap.delete(event.source.id);
        self._saveAppClientMap();
        self.removeConnectedClient(event.source.id);
        const hasClientsForThisApp = [...self._appClientMap.values()].some(id => id === self.swAppId);
        if (!hasClientsForThisApp && self.mqttClient && self.isConnected) {
            self.unsubscribeServer(self.connectionData.topic);
            self.unsubscribeServer(self.connectionData.userId);
            self.mqttClient.disconnect();
            self.isConnected = false;
        }
        return;
    }
    if (event.data && event.data.type === EventType.SwPing) {
        self.broadcast(BroadcastLevel.All, { type: EventType.SwPong, data: { isConnected: !!self.isConnected, appId: self.swAppId } });
        return;
    }
    switch (event.data.type) {
        case EventType.StartMessageDeliveryStatusRetry:
            self.initiateRetryingQueueRequests();
            break;
        case EventType.DeviceRegistered:
        case EventType.UserIdUpdated:
            self.updateUserId(event.data.detail.userId);
            self.updateAjaxHeaders(event.data.detail);
            self.broadcast(BroadcastLevel.All, { type: EventType.UserIdUpdated, data: event.data.detail }, event);
            break;
        case EventType.DeviceUnregistered:
            self.onDeviceUnregistered(event);
            break;
        case EventType.ShouldDisplayNotification:
            self.updateShouldDisplayNotification(event.data.detail.shouldDisplayNotification);
            break;
        case EventType.UpdateAjaxHeaders:
            self.updateAjaxHeaders(event.data.detail);
            break;
        case EventType.AddRetryRequest:
            self.queueRetryRequest(event.data.detail);
            break;
        case EventType.RequestConnection:
            self.onConnectionRequest(event);
            break;
        case EventType.RequestDisconnection:
            self.onDisconnectionRequest(event);
            break;
        case EventType.Startup:
            break;
        case EventType.Shutdown:
            self.onDisconnectionRequest(event);
            break;
        case EventType.RepublishLocally:
            self.onRepublishLocally(event);
            break;
        case EventType.Reconnect:
            if (self.connectedWindowClientIds.indexOf(event.source.id) == -1) {
                self.onConnectionRequest(event);
            }
        default:
            break;
    }
});
self.onDeviceUnregistered = async function (ev) {
    await self.clearUserId();
    self.clearRetryTimer();
    await self.clearAjaxHeaders();
    self.broadcast(BroadcastLevel.All, { type: EventType.DeviceUnregistered }, ev);
    self.connectedWindowClientIds = [];
    await self.idbStorage.ready;
    self.idbStorage.set(DB_KEY_CONNECTED_WINDOW_CLIENTS, self.connectedWindowClientIds);
}
self.updateShouldDisplayNotification = async function (newValue) {
    self.shouldDisplayNotification = newValue;
    await self.db.ready;
    self.db.set('shouldDisplayNotification', self.shouldDisplayNotification);
}
const KEY_USER_ID = "userId";
self.updateUserId = async function (userId) {
    await self.db.ready;
    self.db.set(KEY_USER_ID, userId);
}
self.getUserId = async function () {
    await self.db.ready;
    let userId = await self.db.get(KEY_USER_ID);
    return userId;
}
self.clearUserId = async function () {
    await self.db.ready;
    self.db.remove(KEY_USER_ID);
}
if (messaging)
messaging.onBackgroundMessage(async function (payload) {
    await self.db.ready;
    self.shouldDisplayNotification = await self.db.get("shouldDisplayNotification");
    if (!self.shouldDisplayNotification) {
        return;
    }
    var dataObj = payload.data || {};
    var title = dataObj.title || "";
    var body = dataObj.alert || "";
    var extras = {};
    if (dataObj.extras) {
        extras = JSON.parse(dataObj.extras);
    }
    var icon = extras.iconurl;
    var tag = payload.collapse_key || dataObj.tid;
    var pushextras = {};
    var appId = dataObj.appId;
    pushextras.appId = appId;
    pushextras.tid = dataObj.tid;
    pushextras.url = extras.url;
    var notificationOptions = {
        body: body,
        icon: icon,
        tag: tag,
        requireInteration: true,
        data: pushextras
    };

        var trackDeliveryURL = self._swServerUrl + '/rtmsAPI/api/v1/' + self.swAppId + '/trackDeliveryRequest' +
            '?tid=' + dataObj.tid + '&appId=' + self.swAppId;

    //sendig DR
    fetch(trackDeliveryURL, self.defaultFetchOptions).
        catch(function (err) {
            self.queueRetryRequest({ "request": { url: trackDeliveryURL } });
        });
    //showing notification
    return self.registration.showNotification(title,
        notificationOptions)
});

self.notificationURL = function (event) {
    var url = event.notification.data && event.notification.data.url ? event.notification.data.url : "", url, queryString;
    if (url.indexOf('?') > -1) {
        queryString = url.substring(url.indexOf('?'));
        url = decodeURIComponent(queryString.split('=')[1]);
    }
    return url;
}

self.addEventListener('notificationclick', async function (event) {
    var clickReadDeliveryURL = self._swServerUrl + '/rtmsAPI/api/v1/' + self.swAppId + '/trackReadRequest' + '?appId=' + self.swAppId;
    if (event.notification.data && event.notification.data.tid) {
        clickReadDeliveryURL += '&tid=' + event.notification.data.tid;
    }
    event.notification.close();

    let clickReadDeliveryFetchPromise = fetch(clickReadDeliveryURL, self.defaultFetchOptions);
    let clientsPromise = clients.matchAll({ type: "window", includeUncontrolled: true });

    event.waitUntil(Promise.all([clickReadDeliveryFetchPromise, clientsPromise])
        .then(async ([resp, clientList]) => {
            let appClient = clientList.find(client =>
                self._appClientMap.get(client.id) === self.swAppId
            );

            if (appClient && 'focus' in appClient) {
                let json = await resp.json();
                if (json && json.code == ERROR_API_LEVEL_NOT_SUPPORTED) {
                    appClient.postMessage({ "message": "processUnsupportedSDKVersion", "resp": json, "targetId": self.swAppId });
                }
                return appClient.focus();
            }

            var url = self.notificationURL(event);
            if (url && url !== "" && url !== "undefined" && clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

self.isWritingToRetryQueue = false;
self.queueRetryRequest = async function (failedRequest) {
    let req = failedRequest.request;
    let queueRequest = { url: req.url };
    if (failedRequest.useAjaxHeader && failedRequest.useAjaxHeader == true)
        queueRequest.useAjaxHeader = true;
    else if (req.headers)
        queueRequest.headers = req.headers;
    if (req.type) queueRequest.type = req.type;
    if (req.data)
        queueRequest.data = req.data;

    while (self.isWritingToRetryQueue != false) {
        await sleep(50);
    }
    self.isWritingToRetryQueue = true;
    let pendingRetryRequests = await self.getRetryQueueRequests();
    pendingRetryRequests.push(queueRequest);
    await self.setRetryQueueRequests(pendingRetryRequests);
    self.isWritingToRetryQueue = false;
    self.startRetryTimer();
}

const KEY_AJAX_HEADERS = "ajax_headers";
self.updateAjaxHeaders = async function (detail) {
    let headers = detail.headers;
    await self.db.ready;
    self.db.set(KEY_AJAX_HEADERS, headers);
    if (detail.isTokenValid != undefined) //
            self.isTokenValid = detail.isTokenValid;
    self.initiateRetryingQueueRequests();
}
self.getAjaxHeaders = async function () {
    await self.db.ready;
    let headers = await self.db.get(KEY_AJAX_HEADERS);
    return headers;
}
self.clearAjaxHeaders = async function () {
    await self.db.ready;
    self.db.remove(KEY_AJAX_HEADERS);
}

self.getKeyRetryRequests = async function () {
    return `retry_queue_${await self.getUserId()}`;
}
self.getRetryQueueRequests = async function () {
    await self.db.ready;
    return (await self.db.get(await self.getKeyRetryRequests())) || [];
}
self.setRetryQueueRequests = async function (Requests) {
    await self.db.ready;
    await self.db.set(await self.getKeyRetryRequests(), Requests);
}
self.clearRetryQueueRequests = async function () {
    await self.db.ready;
    await self.db.remove(await self.getKeyRetryRequests());
}

const RETRY_TIMEOUT = 3 * 60 * 1000; //3 minutes
let retryTimer;
self.startRetryTimer = function () {
    if (!retryTimer)
        retryTimer = setTimeout(() => self.initiateRetryingQueueRequests(), RETRY_TIMEOUT);
}
self.clearRetryTimer = function () {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
}
self.isTokenValid;
self.isSecurityTokenAvailableAndValid = async function () {
    const headers = await self.getAjaxHeaders();
    // If Authorization header is missing, treat as valid (return true)
    if (!headers.Authorization) {
        return true;
    }
    // If Authorization header is present, check token validity
    return self.isTokenValid;
}
self.initiateRetryingQueueRequests = async function () {
    self.clearRetryTimer();
    if (!await self.getUserId()) {
        return;
    }
    if (!await self.isSecurityTokenAvailableAndValid()) {
        log('Awaiting valid security token...');
        return;
    }
    let retryRequests = await self.getRetryQueueRequests();
    if (!retryRequests || (retryRequests && retryRequests.length == 0)) {
        return;
    };
    let defaultHeaders = await self.getAjaxHeaders();
    Promise.allSettled(retryRequests.map((request) => {
        let options = {};
        if (request.data) options.body = request.data;
        if (request.type) options.method = request.type;
        if (request.useAjaxHeader != null && request.useAjaxHeader == true)
            options.headers = defaultHeaders;
        else if (request.headers)
            options.headers = request.headers;
        return fetch(request.url, options).then(res => res.json());
    })).then(async results => {
        results.map((res, index) => {
            if (res.status == "fulfilled") {
                if (res.value.code == CODE_SUCCESS) {
                    //clear the request from retry queue
                    retryRequests[index] = null;
                }
                else {
                    let errorCode = _getErrorCode(res.value.code)
                    if (errorCode == ICErrorCodes.TokenRequired
                        || errorCode == ICErrorCodes.TokenExpired
                        || errorCode == ICErrorCodes.InvalidToken
                    ) {
                        self.isTokenValid = false;
                        //Disable retrying untill new token is available
                        self.clearRetryTimer();
                    }
                }
            }
        });
        //save and retry unsent requests 
        let unsentRequests = retryRequests.filter(i => i != null);
        if (unsentRequests && unsentRequests.length == 0)
            await self.clearRetryQueueRequests();
        else {
            self.setRetryQueueRequests(unsentRequests);
            self.startRetryTimer();
        }
    })
}
self.onConnect = function (ev) {
    self.isConnecting = false;
    self.isConnected = true;
    self.subscribeServer(self.connectionData.topic);
    self.subscribeServer(self.connectionData.userId);
    self.broadcast(BroadcastLevel.Connected, { type: EventType.ConnectionEstablished, data: {} });
}

self.getConnectedClients = async function () {
    const allClients = await self.getAllClients();
    self.connectedWindowClientIds = await self.getConnectedWindowClientIDs();
    const aliveIds = new Set(allClients.map(c => c.id));
    const pruned = self.connectedWindowClientIds.filter(id => aliveIds.has(id));
    if (pruned.length !== self.connectedWindowClientIds.length) {
        self.connectedWindowClientIds = pruned;
        await self.idbStorage.set(DB_KEY_CONNECTED_WINDOW_CLIENTS, pruned);
    }
    if (!allClients || allClients.length === 0) {
        return [];
    }
    return allClients.filter(c => aliveIds.has(c.id) && self.connectedWindowClientIds.indexOf(c.id) > -1);
};
self.getAllClients = async function () {
    const allClients = await clients.matchAll({
        includeUncontrolled: true,
    });
    return allClients;
}
const DELAY_BROADCAST_ACROSS_UNFOCUSED_TABS = 10;//milliseconds
let BroadcastLevel = {
    All: 'all',
    Connected: 'connected',
    PriorityFocusedConnected: 'priorityFocusedConnected',
    ConnectedOthers: 'connectedOthers',
    OnlyFocusedConnected: "onlyFocusedConnected"
};
self.broadcast = async function (broadcastLevel, clientMessageEvent, ev) {
    clientMessageEvent.targetId = self.swAppId;
    switch (broadcastLevel) {
        case BroadcastLevel.All:
            {
                var connectedClients = await self.getAllClients();
                connectedClients.forEach((client) => {
                    client.postMessage(clientMessageEvent);
                });
            }
            break;
        case BroadcastLevel.Connected:
            {
                var connectedClients = await self.getConnectedClients();
                connectedClients.forEach((client) => {
                    client.postMessage(clientMessageEvent);
                });
            }
            break;
        case BroadcastLevel.ConnectedOthers:
            {
                var connectedClients = await self.getConnectedClients();
                self.connectedWindowClientIds = await self.getConnectedWindowClientIDs();
                let connected = connectedClients.filter((client) => self.connectedWindowClientIds.indexOf(client.id) > -1 && client.id != ev.source.id);
                connected.forEach(client => {
                    client.postMessage(clientMessageEvent);
                });
            }
            break;
        case BroadcastLevel.PriorityFocusedConnected:
            {
                var connectedClients = await self.getConnectedClients();
                let focusedConnectedClient = connectedClients.find((client) => client.focused == true);
                focusedConnectedClient = focusedConnectedClient || connectedClients[0];
                if (!focusedConnectedClient) {
                    throw ("No focused connected client found! AllConnected:", connectedClients);
                }
                focusedConnectedClient.postMessage(clientMessageEvent);

                let otherClients = connectedClients.filter((client) => client.id != focusedConnectedClient.id);
                otherClients.forEach((client) => {
                    setTimeout(() =>
                        client.postMessage(clientMessageEvent), DELAY_BROADCAST_ACROSS_UNFOCUSED_TABS);
                });
            }
            break;
        case BroadcastLevel.OnlyFocusedConnected:
            {
                var connectedClients = await self.getConnectedClients();
                let focusedConnectedClient = connectedClients.find((client) => client.focused == true);
                focusedConnectedClient = focusedConnectedClient || connectedClients[0];
                if (!focusedConnectedClient) {
                    throw ("No focused connected client found! AllConnected:", connectedClients);
                }
                focusedConnectedClient.postMessage(clientMessageEvent);
            }
            break;
        default:
            log("[broadcast] Unknown broadcast level:", broadcastLevel);
            break;
    }
}
self.subscribeServer = function (topic) {
    var propsObj = { qos: 2 };
    topic = `${self.connectionData.appName}/${topic}`;
    self.mqttClient.subscribe(topic, propsObj);
}
self.unsubscribeServer = function (topic) {
    topic = `${self.connectionData.appName}/${topic}`;
    self.mqttClient.unsubscribe(topic);
}
self.onConnectionLost = (ev) => {
    self.isConnected = false;
    self.isConnecting = false; //this one 
    self.broadcast(BroadcastLevel.Connected, { type: EventType.ConnectionLost, data: ev });
}
self.onConnectFailure = (ev) => {
    self.isConnecting = false;
    self.isConnected = false;
    self.broadcast(BroadcastLevel.Connected, { type: EventType.ConnectionFailure, data: ev });
}
self.onMessageArrived = async (ev) => {
    self.broadcast(BroadcastLevel.OnlyFocusedConnected, { type: EventType.SendDeliveryReceipt, data: { payloadString: ev.payloadString } });
    self.broadcast(BroadcastLevel.PriorityFocusedConnected, { type: EventType.MessageArrived, data: { payloadString: ev.payloadString } });
}
var keepAliveInterval = 10; //keep alive 10 seocnds
self.onConnectionRequest = async function (ev) {
    let data = ev.data.detail;
    if (self.connectedWindowClientIds.indexOf(ev.source.id) == -1) {
        await self.addConnectedClient(ev.source.id);
    }
    if (self.isConnected) {
        self.broadcast(BroadcastLevel.Connected, { type: EventType.ConnectionEstablished, data: {} });
        return;
    }
    if (!data) {
        return;
    }
    self.connectionData = data;
    self.connect(ev);
}
_traceEnabled = false;
self.isConnecting = false;
self.connect = function (ev) {
    if (self.isConnecting) {
        return;
    }
    if (!self.connectionData || !self.connectionData.rtmsdomain) {
        return;
    }
    self.isConnecting = true;
    try {
        self.mqttClient = new Paho.MQTT.Client(
            self.connectionData.rtmsdomain,
            self.connectionData.port,
            self.connectionData.connClientId);
        if (!_traceEnabled) {
            _traceEnabled = true;
            setInterval(() => function () {
                self.mqttClient.stopTrace();

                self.mqttClient.startTrace();
            }, 30000);
        }
        self.mqttClient.startTrace();
        self.mqttClient.onConnectionLost = self.onConnectionLost.bind(self);
        self.mqttClient.onMessageArrived = self.onMessageArrived.bind(self);
        var context = {};
        self.connectOptions = {
            invocationContext: context,
            onSuccess: self.onConnect.bind(self),
            timeout: 5,
            cleanSession: false,
            useSSL: self.connectionData.isSSL !== false,
            onFailure: self.onConnectFailure.bind(self),
            userName: self.connectionData.uniqueClientId,
            password: self.connectionData.password,
            keepAliveInterval: keepAliveInterval
        };
        self.mqttClient.connect(self.connectOptions);
    } catch (e) {
        self.isConnecting = false;
    }
}
self.onDisconnectionRequest = async function (ev) {
    let index = self.connectedWindowClientIds.indexOf(ev.source.id);
    if (index == -1) {
        log("The client is not connected - ", ev.client);
    }
    await self.removeConnectedClient(ev.source.id);
    if (self.connectedWindowClientIds && self.connectedWindowClientIds.length == 0 && self.mqttClient && self.isConnected) {
        self.unsubscribeServer(self.connectionData.topic);
        self.unsubscribeServer(self.connectionData.userId);
        self.mqttClient.disconnect();
        self.isConnected = false;
    }
}
self.onRepublishLocally = async function (ev) {
    self.broadcast(BroadcastLevel.ConnectedOthers, { type: EventType.LocalMessageRepublished, message: ev.data.detail.message }, ev);
}

let requestStallTimeOut = undefined;
self.precachedResources = {};
const STALL_DUPLICATE_REQUESTS_BY_MILLISECONDS = 100;
async function cacheFirst(ev) {
    let request = ev.request.clone();
    let revisedURL = new URL(request.url);
    let readReceiptTransactionIds = revisedURL.searchParams.get('rr');
    readReceiptTransactionIds = readReceiptTransactionIds.replace('?', '');

    while (self.precachedResources[readReceiptTransactionIds] && self.precachedResources[readReceiptTransactionIds].status == "InProgress") {
        await sleep(STALL_DUPLICATE_REQUESTS_BY_MILLISECONDS); //Stall duplicate requests while waiting for first request to resolve.
    }

    if (self.precachedResources[readReceiptTransactionIds] && self.precachedResources[readReceiptTransactionIds].status == "Completed") {
        return new Response(JSON.stringify(precachedResources[readReceiptTransactionIds].json), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        if (!self.precachedResources[readReceiptTransactionIds])
            self.precachedResources[readReceiptTransactionIds] = { response: null, status: "InProgress" };
        revisedURL.searchParams.delete('rr'); // Remove rr from URL if present. Should not pass the tids in url onwards, hence revising
        const networkResponse = await fetch(revisedURL, request);
        let respDataJSON = await networkResponse.json();
        if (networkResponse.ok) {
            self.precachedResources[readReceiptTransactionIds] = {
                json: respDataJSON,
                status: "Completed"
            };
        }
        else {
            clearTimeout(requestStallTimeOut);
            return Response.error();
        }
        return new Response(JSON.stringify(precachedResources[readReceiptTransactionIds].json), {
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        if (requestStallTimeOut)
            clearTimeout(requestStallTimeOut);
        return Response.error();
    }
}

function sleep(ms) {
    return new Promise(resolve => requestStallTimeOut = setTimeout(resolve, ms));
}

self.addEventListener("fetch", (event) => {
    let url = new URL(event.request.url);
    if (url.pathname.includes('/deliveryupdate') && url.searchParams.get("rr")) {
        event.respondWith(cacheFirst(event));
    }
});

self.addConnectedClient = async function (clientId) {
    await self.idbStorage.ready;
    self.connectedWindowClientIds = self.connectedWindowClientIds ? self.connectedWindowClientIds : await self.getConnectedWindowClientIDs();
    self.connectedWindowClientIds.push(clientId);
    self.idbStorage.set(DB_KEY_CONNECTED_WINDOW_CLIENTS, self.connectedWindowClientIds);
}
self.removeConnectedClient = async function (clientId) {
    await self.idbStorage.ready;
    let index = self.connectedWindowClientIds.indexOf(clientId);
    if (index > -1) {
        self.connectedWindowClientIds.splice(index, 1);
    }
    self.idbStorage.set(DB_KEY_CONNECTED_WINDOW_CLIENTS, self.connectedWindowClientIds);
}
self.getConnectedWindowClientIDs = async function () {
    await self.idbStorage.ready;
    self.connectedWindowClientIds = await self.idbStorage.get(DB_KEY_CONNECTED_WINDOW_CLIENTS);
    return self.connectedWindowClientIds || [];
}
function _getErrorCode(code) {
    var icErrorCode;
    if (code === 38) {
        icErrorCode = ICErrorCodes.InvalidToken;
    } else if (code === 39) {
        icErrorCode = ICErrorCodes.TokenRequired;
    } else if (code === 40) {
        icErrorCode = ICErrorCodes.TokenExpired;
    }
    return icErrorCode;
}

log = console.log;