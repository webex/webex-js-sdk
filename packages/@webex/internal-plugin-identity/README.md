# @webex/internal-plugin-identity

Internal Webex SDK plugin for generating client identity credentials and obtaining signed
certificates from the Webex Certificate Authority. Credentials are cached per contact for the
lifetime of the Webex client instance.

The plugin self-registers when imported and is available as `webex.internal.identity`. Meetings
uses `getCredentials(contactId)` and `getTrustAnchors()` when joining E2EE meetings.

Set customer CA roots with `setUserIdentityRoots({userIdentityRootsPem})`. Pass one or more
concatenated PEM root certificates. Pass an empty string to clear them.

For local testing with customer-provided credentials, register a PKCS#8 private key and leaf-first
PEM certificate chain for one contact. Meetings uses these credentials first and also includes
Webex-issued credentials when available:

```js
webex.internal.identity.setUserIdentityCredentials(contactId, {
  privateKeyPkcs8Pem,
  certificateChainPem,
});
```

Passing `undefined` as the credentials removes the customer credentials for that contact. Meetings
then uses Webex-issued credentials only. `contactId` is the same identifier supplied to
`getCredentials`; it is not the email address in the certificate's SAN.
