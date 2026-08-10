# FPV-1237 Mercury Cluster Validation Design

## Goal

Prevent an untrusted Mercury `ActiveClusterStatusEvent` from remapping a service to a cluster that belongs to a different service.

## Scope

Change `ServicesV2.switchActiveClusterIds()` in `@webex/webex-core`. The Mercury event handler and server-side publish authorization are outside this client-side defense-in-depth fix.

## Design

Treat pushed active-cluster values as hints. For every `[serviceName, clusterId]` pair, find the cluster in the current U2C catalog and require its `serviceName` to equal the map key. If any cluster is missing or belongs to another service, reject the entire pushed map and force an authoritative U2C catalog refresh. Apply the map only when every pair is valid.

This preserves valid cluster migrations, retains the existing refresh behavior for unknown clusters, and prevents partial application of mixed valid and invalid input.

## Testing

Add a webex-core unit regression test that uses an existing cluster ID belonging to a different service. Verify that `initServiceCatalogs(true)` is called and `_updateActiveServices()` is not called. Retain the existing tests for accepted matching clusters and missing clusters.

Run the targeted ServicesV2 unit tests, the `@webex/webex-core` unit suite, and the webex-core source build with Node.js 22.14.

## Security Considerations

The patch validates both identifier existence and service ownership at the trust boundary. It does not authenticate Mercury events; authoritative publisher authorization remains a server-side requirement. No credentials, tokens, cryptographic keys, or certificates are added.
