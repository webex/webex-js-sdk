# @webex/internal-plugin-identity

Internal Webex SDK plugin for generating client identity credentials and obtaining signed
certificates from the Webex Certificate Authority. Credentials are cached per contact for the
lifetime of the Webex client instance.

The plugin self-registers when imported and is available as `webex.internal.identity`. Meetings
uses `getCredentials(contactId)` and `getTrustAnchors()` when joining E2EE meetings.

For local testing with customer-provided credentials, register a PKCS#8 private key and leaf-first
PEM certificate chain for one contact:

```js
webex.internal.identity.setUserIdentityCredentials(contactId, {
  privateKeyPkcs8Pem,
  certificateChainPem,
});
```

Passing `undefined` as the credentials removes that contact's override and resumes CA-issued
credentials. `contactId` is the same identifier supplied to `getCredentials`; it is not the email
address in the certificate's SAN.
