/*!
 * web-extension-bridge web sample.
 *
 * Local testing only. The bridge allow-lists this page's own origin because the dev
 * server and the sample extension both run on the machine you are reading this on.
 * A real deployment lists its exact production origin instead.
 */

(function main() {
  'use strict';

  var MAX_LOG_ROWS = 50;
  var SLOW_HANDLER_MS = 30000;

  var elements = {
    pill: document.getElementById('connection-pill'),
    publishForm: document.getElementById('publish-form'),
    messageText: document.getElementById('message-text'),
    sharedValue: document.getElementById('shared-value'),
    servedCount: document.getElementById('served-count'),
    lastTopic: document.getElementById('last-topic'),
    log: document.getElementById('event-log'),
    counters: document.getElementById('counters'),
    errorSurface: document.getElementById('error-surface'),
    refreshCounters: document.getElementById('refresh-counters'),
    clearLog: document.getElementById('clear-log'),
    originLabel: document.getElementById('origin-label'),
  };

  var served = 0;

  elements.originLabel.textContent = window.location.origin;

  /**
   * Append a row to the capped log. Values are always written with textContent, so a
   * payload that arrives from the extension can never become markup.
   *
   * @param {string} kind - Row category, used for colouring: out, in, error or info.
   * @param {string} text - Line to show.
   */
  function log(kind, text) {
    var row = document.createElement('li');

    row.dataset.kind = kind;

    var time = document.createElement('span');

    time.className = 'log__time';
    time.textContent = new Date().toLocaleTimeString();

    var label = document.createElement('span');

    label.className = 'log__kind';
    label.textContent = kind;

    var body = document.createElement('span');

    body.textContent = text;

    row.appendChild(time);
    row.appendChild(label);
    row.appendChild(body);
    elements.log.appendChild(row);

    while (elements.log.childElementCount > MAX_LOG_ROWS) {
      elements.log.removeChild(elements.log.firstElementChild);
    }

    elements.log.scrollTop = elements.log.scrollHeight;
  }

  /**
   * Show a failure on the dedicated error surface. Bridge failures carry a stable
   * `code`; anything else is reported by name only.
   *
   * @param {unknown} error - Thrown value.
   */
  function showError(error) {
    var code = error && typeof error.code === 'string' ? error.code : 'UNKNOWN';
    var message = error && typeof error.message === 'string' ? error.message : String(error);

    elements.errorSurface.hidden = false;
    elements.errorSurface.textContent = code + ': ' + message;
    log('error', code + ': ' + message);
  }

  /**
   * @param {string} state - One of waiting, connected or disconnected.
   * @param {string} text - Pill label.
   */
  function setPill(state, text) {
    elements.pill.className = 'pill pill--' + state;
    elements.pill.textContent = text;
  }

  /**
   * Record that a request was served and refresh the two readouts next to the field.
   *
   * @param {string} topic - Topic that was just served.
   */
  function countRequest(topic) {
    served += 1;
    elements.servedCount.textContent = String(served);
    elements.lastTopic.textContent = topic;
  }

  var bridge = WebExtensionBridge.createWebBridge({
    allowedOrigins: [window.location.origin],
  });

  bridge.onConnected(function onConnected() {
    setPill('connected', 'Extension connected');
    log('info', 'Extension connected');
    elements.errorSurface.hidden = true;
  });

  bridge.onDisconnected(function onDisconnected(reason) {
    setPill('disconnected', 'Extension disconnected');
    log('info', 'Extension disconnected: ' + reason);
  });

  // FR2: answer requests pulled by the extension. The value is read here, at request
  // time, so the popup never shows a stale copy.
  bridge.requestHandler('snapshot', function snapshot() {
    countRequest('snapshot');

    return {
      value: elements.sharedValue.value,
      requestsServed: served,
      at: new Date().toISOString(),
    };
  });

  bridge.requestHandler(
    'echo',
    function echo(payload) {
      countRequest('echo');

      return {echoed: payload};
    },
    {
      validate: function isObject(payload) {
        return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
      },
    }
  );

  // Deliberately broken, so HANDLER_ERROR is demonstrable: the popup sees a generic
  // message and this text never crosses the bridge.
  bridge.requestHandler('boom', function boom() {
    countRequest('boom');

    throw new Error('secret internal detail that must not reach the extension');
  });

  // Deliberately slower than any sane timeout, so TIMEOUT is demonstrable.
  bridge.requestHandler('slow', function slow() {
    countRequest('slow');

    return new Promise(function neverInTime(resolve) {
      window.setTimeout(function resolveLate() {
        resolve({finallyDone: true});
      }, SLOW_HANDLER_MS);
    });
  });

  elements.publishForm.addEventListener('submit', function onSubmit(event) {
    event.preventDefault();

    var text = elements.messageText.value;

    try {
      // FR1: fire and forget. The extension buffers this until its popup opens.
      bridge.publish('message', {payload: text, at: new Date().toISOString()});
      elements.errorSurface.hidden = true;
      log('out', 'publish message: ' + text);
    } catch (error) {
      showError(error);
    }
  });

  elements.refreshCounters.addEventListener('click', function onRefresh() {
    var counters = bridge.getCounters();
    var names = Object.keys(counters).sort();

    elements.counters.textContent = '';

    names.forEach(function renderCounter(name) {
      var group = document.createElement('div');
      var term = document.createElement('dt');
      var value = document.createElement('dd');

      term.textContent = name;
      value.textContent = String(counters[name]);
      group.appendChild(term);
      group.appendChild(value);
      elements.counters.appendChild(group);
    });
  });

  elements.clearLog.addEventListener('click', function onClear() {
    elements.log.textContent = '';
    elements.errorSurface.hidden = true;
  });

  log('info', 'Page bridge ready. Waiting for the extension content script.');
})();
