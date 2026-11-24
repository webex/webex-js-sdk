# CI gate probe — DO NOT MERGE

This draft PR is a disposable experiment requested by the repository maintainer.

Controlled non-required-check failure. The private fixture passes test:unit and deliberately fails test:integration. A later revision will wait briefly so its workflow can be cancelled in a bounded window.

No production SDK behavior or branch-protection setting is changed. Do not merge this branch.

Phase 2: unit passes; integration waits at most 120 seconds for controlled workflow cancellation.
