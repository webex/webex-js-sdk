// TODO: Try to find alternative to using Blob and script here
const workerScript = `
console.log("*** Keepalive Worker Thread ***");
let intervalId, intervalDuration, timeOutId, isSocketClosed, closeSocketTimeout;
let initialised = false;
let initiateWebSocketClosure = false;

const resetOfflineHandler = function () {
  if (timeOutId) {
    initialised = false;
    clearTimeout(timeOutId);
    timeOutId = null;
  }
};

const checkOnlineStatus = function () {
  const onlineStatus = navigator.onLine;
  console.log(
    \`[WebSocketStatus] event=checkOnlineStatus | timestamp=${new Date()}, UTC=${new Date().toUTCString()} | online status=\`,
    onlineStatus
  );
  return onlineStatus;
};

// Checks network status and if it's offline then force closes WebSocket
const checkNetworkStatus = function () {
  const onlineStatus = checkOnlineStatus();
  postMessage({ type: "keepalive", onlineStatus });
  if (!onlineStatus && !initialised) {
    initialised = true;
    // Sets a timeout of 16s, checks if socket didn't close then it closes forcefully
    timeOutId = setTimeout(() => {
      if (!isSocketClosed) {
        initiateWebSocketClosure = true;
        postMessage({ type: "closeSocket" });
      }
    }, closeSocketTimeout);
  }

  if (onlineStatus && initialised) {
    initialised = false;
  }

  if (initiateWebSocketClosure) {
    initiateWebSocketClosure = false;
    clearTimeout(timeOutId);
    timeOutId = null;
  }
};

addEventListener("message", (event) => {
  if (event.data?.type === "start") {
    intervalDuration = event.data?.intervalDuration || 4000;
    closeSocketTimeout = event.data?.closeSocketTimeout || 5000;
    console.log("event=Websocket startWorker | keepalive Worker started");
    intervalId = setInterval(
      (checkIfSocketClosed) => {
        checkNetworkStatus();
        isSocketClosed = checkIfSocketClosed;
      },
      intervalDuration,
      event.data?.isSocketClosed
    );

    resetOfflineHandler();
  }

  if (event.data?.type === "terminate" && intervalId) {
    console.log("event=Websocket terminateWorker | keepalive Worker stopped");
    clearInterval(intervalId);
    intervalId = null;
    resetOfflineHandler();
  }
});

// Listen for online and offline events
self.addEventListener('online', () => {
  console.log('Network status: online');
  checkNetworkStatus();
});

self.addEventListener('offline', () => {
  console.log('Network status: offline');
  checkNetworkStatus();
});
`;

export default workerScript;
