# plugin-encryption

## Requirements

- Org admin needs to be able to download and decrypt media files.
- Needs an input token, take in an attachment URL and return the decrypted file.
- Decryption happens on the SDK side.
- Needs to be in TypeScript.

## Sample Code

```typescript
  import { decryptAttachment } from '@webex/plugin-encryption';
  import { Webex } from '@webex/core';

  const webex = new Webex({
    credentials: {
      access_token
    }
  });

  try {
    const decryptedFile = await webex.encryption.decryptAttachment(attachmentURL);
    // Do something with the decrypted file
  } catch (error) {
    // Handle error
  }
  
```
