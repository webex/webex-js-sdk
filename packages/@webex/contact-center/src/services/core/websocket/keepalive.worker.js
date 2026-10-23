// TODO: Try to find alternative to using Blob and script here
const workerScript = `
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
    clearInterval(intervalId);
    intervalId = null;
    resetOfflineHandler();
  }
});

// Listen for online and offline events
self.addEventListener('online', () => {
  checkNetworkStatus();
});

self.addEventListener('offline', () => {
  checkNetworkStatus();
});
`;

export default workerScript;
