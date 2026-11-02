---
type: Module Spec
title: Logger plugin specification
description: Public logger calls, retained records and consumer rules.
tags: [module, specification]
---

# Logger contract

Use `webex.logger.<level>(...args)` for SDK logs and `client_<level>(...args)` for client logs.
Printing and buffering have separate thresholds. Debug and trace are not buffered by default.
`logToBuffer` and `client_logToBuffer` always retain an info record without printing.

| Interface | Contract |
| --- | --- |
| `getRecords()` | New record wrappers from retained history, in sequence order. Leaves upload cursors unchanged. |
| `on('log:record', listener)` | Native synchronous notification after an entry is retained. |
| `off('log:record', listener)` | Remove the same listener reference. |
| `formatLogs({diff})` | Existing support text, with the existing upload-cursor behavior. |
| `updateLastSubmittedIndex()` | Mark the current support-upload position as successful. |
| `resetBufferToLastSuccessfulUpload()` | Restore the last successful support-upload position. |

Records contain `sequence`, `timestamp`, `level`, `source` and `body`.
Time is SDK acceptance time in Unix milliseconds. Replay keeps this time.
Sequence increases once per retained entry in one logger instance.
`body` is the existing formatted support text after message redaction.
Optional metadata supplies `source`, `eventName` and `attributes`.

Set `config.logger.metadataField` to the argument field that holds metadata.
Without this setting, argument objects remain ordinary message data.
Text redaction does not sanitize metadata. Callers must supply safe, serializable values.
Callers and consumers must leave metadata unchanged after logging.

Set optional `config.logger.consoleMethods` to original host console functions.
Buffered calls use a supplied function; printed-only calls use the normal console method.
Missing functions fall back to the normal method. Print and buffer thresholds stay unchanged.
`separateLogBuffers` selects shared history or separate SDK and client histories.
History limits and support-buffer positions stay unchanged.

Listeners must not throw or log synchronously back into the same SDK logger.
Native nested events can reach later listeners out of order. History remains ordered.
Consumers that use a sequence checkpoint can skip an older event after nested logging.

Check behavior with focused logger tests in Node and Chrome. Build with `yarn workspace @webex/plugin-logger build:src`.
See the [architecture](../../docs/architecture.md) for ownership and data flow.
