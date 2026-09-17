/*!
 * web-extension-bridge sample popup.
 *
 * The popup owns no bridge of its own: the bridge lives in the service worker, which
 * outlives this document. `createExtensionClient()` mirrors the bridge surface and
 * proxies each call over a private command protocol.
 */

/* global WebExtensionBridgeClient */

(function main() {
  'use strict';

  var MAX_PUSH_ROWS = 40;

  var elements = {
    status: document.getElementById('status'),
    connections: document.getElementById('connections'),
    refresh: document.getElementById('refresh'),
    topic: document.getElementById('topic'),
    payload: document.getElementById('payload'),
    timeout: document.getElementById('timeout'),
    send: document.getElementById('send'),
    abort: document.getElementById('abort'),
    result: document.getElementById('result'),
    pushes: document.getElementById('pushes'),
    loadBuffered: document.getElementById('load-buffered'),
    counters: document.getElementById('counters'),
    loadCounters: document.getElementById('load-counters'),
  };

  var client = WebExtensionBridgeClient.createExtensionClient();
  var selectedTabId = null;
  var controller = null;

  /**
   * @param {string} state - waiting, connected or disconnected.
   * @param {string} text - Pill label.
   */
  function setStatus(state, text) {
    elements.status.className = 'pill pill--' + state;
    elements.status.textContent = text;
  }

  /**
   * @param {string} state - ok or error, used for colouring.
   * @param {string} text - Body text, always written with textContent.
   */
  function setResult(state, text) {
    elements.result.dataset.state = state;
    elements.result.textContent = text;
  }

  /**
   * Add a row to the capped push log.
   *
   * @param {string} topic - Push topic.
   * @param {unknown} payload - Push payload, rendered as JSON text.
   * @param {object} meta - Push metadata from the bridge.
   * @param {string} source - live or buffered.
   */
  function addPush(topic, payload, meta, source) {
    var row = document.createElement('li');
    var topicEl = document.createElement('span');
    var bodyEl = document.createElement('span');
    var metaEl = document.createElement('span');

    topicEl.className = 'list__topic';
    topicEl.textContent = topic;
    bodyEl.textContent = JSON.stringify(payload);
    metaEl.className = 'list__meta';
    metaEl.textContent = source + ' · tab ' + meta.tabId;

    row.appendChild(topicEl);
    row.appendChild(bodyEl);
    row.appendChild(metaEl);
    elements.pushes.insertBefore(row, elements.pushes.firstChild);

    while (elements.pushes.childElementCount > MAX_PUSH_ROWS) {
      elements.pushes.removeChild(elements.pushes.lastElementChild);
    }
  }

  /**
   * @param {unknown} error - Rejection from the bridge.
   * @returns {string} Stable code plus generic message, never a page stack trace.
   */
  function describe(error) {
    var code = error && typeof error.code === 'string' ? error.code : 'UNKNOWN';
    var message = error && typeof error.message === 'string' ? error.message : String(error);

    return code + '\n' + message;
  }

  /** Render the connection list and pick a default target. */
  function refreshConnections() {
    return client
      .listConnections()
      .then(function render(connections) {
        elements.connections.textContent = '';

        if (connections.length === 0) {
          selectedTabId = null;
          setStatus('disconnected', 'No page attached');

          return;
        }

        if (selectedTabId === null) {
          selectedTabId = connections[0].tabId;
        }

        setStatus(
          'connected',
          connections.length === 1 ? '1 tab attached' : connections.length + ' tabs attached'
        );

        connections.forEach(function renderOne(connection) {
          var row = document.createElement('li');
          var origin = document.createElement('span');
          var meta = document.createElement('span');
          var pick = document.createElement('button');

          row.dataset.selected = String(connection.tabId === selectedTabId);
          origin.className = 'list__topic';
          origin.textContent = connection.origin;
          meta.className = 'list__meta';
          meta.textContent = 'tab ' + connection.tabId;
          pick.type = 'button';
          pick.className = 'button';
          pick.textContent = connection.tabId === selectedTabId ? 'Target' : 'Use';
          pick.addEventListener('click', function onPick() {
            selectedTabId = connection.tabId;
            refreshConnections();
          });

          row.appendChild(origin);
          row.appendChild(meta);
          row.appendChild(pick);
          elements.connections.appendChild(row);
        });
      })
      .catch(function onFailure(error) {
        setStatus('disconnected', 'Worker unreachable');
        setResult('error', describe(error));
      });
  }

  elements.send.addEventListener('click', function onSend() {
    var topic = elements.topic.value;
    var raw = elements.payload.value.trim();
    var timeoutMs = Number(elements.timeout.value);
    var payload;

    if (raw.length > 0) {
      try {
        payload = JSON.parse(raw);
      } catch (error) {
        setResult('error', 'Payload is not valid JSON, so nothing was sent.');

        return;
      }
    }

    controller = new AbortController();
    elements.abort.disabled = false;
    elements.send.disabled = true;
    setResult('ok', 'Waiting for the page…');

    var options = {signal: controller.signal};

    if (Number.isFinite(timeoutMs)) {
      options.timeoutMs = timeoutMs;
    }

    if (selectedTabId !== null) {
      options.tabId = selectedTabId;
    }

    client
      .request(topic, payload, options)
      .then(function onValue(value) {
        setResult('ok', JSON.stringify(value, null, 2));
      })
      .catch(function onError(error) {
        setResult('error', describe(error));
      })
      .then(function settle() {
        elements.send.disabled = false;
        elements.abort.disabled = true;
        controller = null;
      });
  });

  elements.abort.addEventListener('click', function onAbort() {
    if (controller) {
      controller.abort();
    }
  });

  elements.refresh.addEventListener('click', function onRefresh() {
    refreshConnections();
  });

  elements.loadBuffered.addEventListener('click', function onLoadBuffered() {
    client
      .getBufferedMessages({limit: MAX_PUSH_ROWS})
      .then(function render(messages) {
        elements.pushes.textContent = '';
        messages.forEach(function renderOne(message) {
          addPush(message.topic, message.payload, message.meta, 'buffered');
        });
      })
      .catch(function onError(error) {
        setResult('error', describe(error));
      });
  });

  elements.loadCounters.addEventListener('click', function onLoadCounters() {
    client
      .getCounters()
      .then(function render(counters) {
        elements.counters.textContent = '';
        Object.keys(counters)
          .sort()
          .forEach(function renderOne(name) {
            var term = document.createElement('dt');
            var value = document.createElement('dd');

            term.textContent = name;
            value.textContent = String(counters[name]);
            elements.counters.appendChild(term);
            elements.counters.appendChild(value);
          });
      })
      .catch(function onError(error) {
        setResult('error', describe(error));
      });
  });

  // Live pushes, broadcast by the worker while this popup is open.
  client.subscribe(function onPush(topic, payload, meta) {
    addPush(topic, payload, meta, 'live');
  });

  chrome.runtime.sendMessage({sample: 'clear-badge'}).catch(function ignore() {
    // The worker may not have started yet; the badge clears on the next open.
  });

  refreshConnections();
})();
