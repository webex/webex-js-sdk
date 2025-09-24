import {get, set} from 'lodash';

const decryptInPlace = async (item, valuePath, keyPath, webex) => {
  const encryptedValue = get(item, valuePath);
  const encryptionKeyUrl = get(item, keyPath);

  const decryptedValue = await webex.internal.encryption.decryptText(
    encryptionKeyUrl,
    encryptedValue
  );

  set(item, valuePath, decryptedValue);
};

export const decryptToolUse = async (data, webex) => {
  await decryptInPlace(data, 'value.value', 'encryptionKeyUrl', webex);
};

export const decryptCitedAnswer = async (data, webex) => {
  if (data.value.citations) {
    await Promise.all(
      data.value.citations.map((citation, index) => {
        return decryptInPlace(data, `value.citations.${index}.name`, 'encryptionKeyUrl', webex);
      })
    );
  }

  await decryptInPlace(data, 'value.value', 'encryptionKeyUrl', webex);
};

export const decryptMessage = async (data, webex) => {
  await decryptInPlace(data, 'value', 'encryptionKeyUrl', webex);
};
