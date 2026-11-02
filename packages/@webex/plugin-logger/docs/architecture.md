---
type: Architecture
title: '@webex/plugin-logger architecture'
description: Logger ownership, console routing and record consumers.
tags: [architecture]
---

# Logger architecture

The SDK logger formats text, redacts message fields and retains bounded history.
The host application owns console capture. Record consumers own conversion and delivery.

<table>
  <caption>SDK log flow</caption>
  <tr><td>SDK or client log call</td></tr>
  <tr><td>↓ Extract optional metadata; redact message fields</td></tr>
  <tr><td>Console output and retained history use separate level checks</td></tr>
  <tr><td>↓ Retained entry receives time and sequence</td></tr>
  <tr><td>Support upload: formatLogs() · Record consumer: getRecords() and log:record</td></tr>
</table>

- `src/index.js` registers the logger with `replace: true`.
- `logger.js` owns level selection, text formatting, buffers and support-upload cursors.
- `metadataField` selects caller metadata. Text redaction does not sanitize metadata.
- Callers must supply safe metadata and leave it unchanged after logging.
- Optional `consoleMethods` supplies original host console functions by method name.
- Buffered calls use a supplied original method to avoid a second host-capture record.
- Printed-only calls use the normal console method, so host capture can retain them.
- Missing supplied methods fall back to the normal console method.
- Hosts without this option keep their normal console route.
- Record consumers use native `on/off('log:record')` events and retained snapshots.
- Listeners must not throw or log synchronously back into the same SDK logger.
- Nested logging can deliver a later sequence first; a throwing listener can stop later listeners.
- The SDK keeps both records in history. It adds no event queue or delivery guarantee.
- The SDK does not own OTel, HTTP export or persistent storage.

See the [logger contract](../src/docs/README.md) and [package instructions](../AGENTS.md).
