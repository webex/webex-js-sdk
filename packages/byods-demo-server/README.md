## BYoDS Demo Server

Run the demo with Node.js 22.14:

```bash
yarn workspace byods-demo-server dev
# Or use the integration environment:
yarn workspace byods-demo-server dev:integration
```

Open `/config` and provide the Service App client ID, client secret, organization ID, and Service App refresh token. After authorization, the demo opens `/data-source` for that organization.

Configuration and tokens stay in memory. Configure again to replace the active instance and cancel its JWS refresh schedules. Use this server for local demos.

If bcrypt causes issues on macOS, run `yarn rebuild`.
