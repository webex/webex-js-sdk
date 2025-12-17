import {get, set} from 'lodash';

const decryptInPlace = async (item, valuePath, keyPath, webex) => {
  const encryptedValue = get(item, valuePath);
  const encryptionKeyUrl = get(item, keyPath);

  if (!encryptedValue || !encryptionKeyUrl) {
    return;
  }

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
export const decryptScheduleMeeting = async (data, webex) => {
  // Decrypt commentary in parameters
  await decryptInPlace(data, 'parameters.commentary', 'encryptionKeyUrl', webex);

  const meetingData = data.value?.results?.data;
  if (meetingData) {
    // Decrypt attendee emails
    if (meetingData.attendees) {
      await Promise.all(
        meetingData.attendees.map((attendee, index) => {
          return decryptInPlace(
            data,
            `value.results.data.attendees.${index}.email`,
            'encryptionKeyUrl',
            webex
          );
        })
      );
    }

    // Decrypt other fields in the meeting data
    await Promise.all([
      decryptInPlace(data, 'value.results.data.title', 'encryptionKeyUrl', webex),
      decryptInPlace(data, 'value.results.data.inScopeReply', 'encryptionKeyUrl', webex),
      decryptInPlace(data, 'value.results.data.meetingLink', 'encryptionKeyUrl', webex),
      decryptInPlace(data, 'value.results.data.description', 'encryptionKeyUrl', webex),
    ]);
  }
};

export const decryptMessage = async (data, webex) => {
  await decryptInPlace(data, 'value', 'encryptionKeyUrl', webex);
};

export const decryptWorkspace = async (data, webex) => {
  await decryptInPlace(data, 'value.value', 'encryptionKeyUrl', webex);
};
