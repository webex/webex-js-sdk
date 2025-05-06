# Webex Encryption Kitchen Sink

This project demonstrates how to interact with the Webex encryption service using the Webex JS SDK. It includes examples of how to authenticate, initialize the SDK, and decrypt files.

## Getting Started

### Prerequisites

- An access token from the Webex developer portal with the spark:kms
- This token can also be obtained from the agent desktop by using developer tools and inspecting the local storage for access token

### Installation

1. Clone the repository.
2. yarn build:local
3. yarn samples:build && yarn samples:serve

### Usage

#### Authentication

1. Navigate to [https://localhost:8000/samples/plugin-encryption](https://localhost:8000/samples/plugin-encryption)
2. Get an access token from either the developer portal or from the agent desktop
3. Make sure to select the environment to be integration or production
4. Enter your access token in the "Access Token" field.
5. Click the "Initialize Webex" button to initialize the Webex SDK.

#### Initialize Webex SDK

The Webex SDK is initialized using the access token provided by the user. The initialization process registers the Webex JS SDK as a device.

```typescript
function initializeWebex(accessToken) {
  const webex = Webex.init({
    credentials: {
      access_token: accessToken,
    },
  });

  return new Promise((resolve) => {
    webex.once('ready', () => {
      localStorage.setItem('access-token', accessToken);
      localStorage.setItem('date', new Date().getTime() + 60 * 60 * 1000); // 1 hour expiration
      webex.cypher.register().then(() => {
        resolve(webex);
      });
    });
  });
}
```

### Decrypt Files

To decrypt a file, provide the encrypted file URL, the desired file name, and the MIME type.

```typescript
async function decryptFile(webex, encryptedFileUrl, options, decryptedFileName, mimeType) {
  try {
    const decryptedFileBuf = await webex.cypher.downloadAndDecryptFile(encryptedFileUrl, options);
    const file = new File([decryptedFileBuf], decryptedFileName, { type: mimeType });
    const url = window.URL.createObjectURL(file);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = decryptedFileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    console.log('File decrypted and downloaded successfully');
  } catch (error) {
    console.error('Error decrypting file:', error);
  }
}

const attachmentURL = 'https:/myfileurl.xyz/zzz/fileid?keyUri=somekeyuri&JWE=somejwe';
const options = {
  useFileService: false,
  jwe: somejwe, // Provide the JWE here if not already present in the attachmentURL
  keyUri: someKeyUri // Provide the keyURI here if not already present in the attachmentURL
};

await decryptFile(webex, attachmentURL, options, 'MyFile.png', 'image/png');
```

### Example Usage

```typescript
const accessToken = 'YOUR_ACCESS_TOKEN';
const encryptedFileUrl = 'https://example.com/encrypted-file';
const decryptedFileName = 'my-decrypted-file.jpeg';
const mimeType = 'image/jpeg';

initializeWebex(accessToken).then((webex) => {
  decryptFile(webex, encryptedFileUrl, decryptedFileName, mimeType);
});
```

### Additional Information

For more information on the Webex JS SDK, please visit the [developer portal](https://developer.webex.com/).

### License

This project is licensed under the Cisco General Terms - see the [LICENSE](https://github.com/webex/webex-js-sdk/blob/next/LICENSE.md) for details.
