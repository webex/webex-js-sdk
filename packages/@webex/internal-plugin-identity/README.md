# @webex/internal-plugin-identity

Internal Webex SDK plugin for generating client identity credentials and obtaining signed
certificates from the Webex Certificate Authority. Credentials are cached per contact for the
lifetime of the Webex client instance.

The plugin self-registers when imported and is available as `webex.internal.identity`. Meetings
uses `getCredentials(contactId)` and `getTrustAnchors()` when joining E2EE meetings.
