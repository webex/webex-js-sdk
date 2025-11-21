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

const example = {
  eventType: 'assistant-api.response',
  sequence: 1,
  finished: true,
  clientRequestId: 'd985471d-90ad-4dd2-ba29-025fa54dd7b0',
  responseId: 'b6893a00-c6cc-11f0-adb9-f9fe7ea2ec69',
  responseType: 'response',
  response: {
    sessionId: 'a64345a0-c6cc-11f0-8c21-a7bce84cd4be',
    sessionUrl:
      'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/a64345a0-c6cc-11f0-8c21-a7bce84cd4be',
    messageId: 'b688c4d0-c6cc-11f0-adb9-f9fe7ea2ec69',
    messageUrl:
      'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/a64345a0-c6cc-11f0-8c21-a7bce84cd4be/messages/b688c4d0-c6cc-11f0-adb9-f9fe7ea2ec69',
    responseId: 'b6893a00-c6cc-11f0-adb9-f9fe7ea2ec69',
    responseUrl:
      'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/a64345a0-c6cc-11f0-8c21-a7bce84cd4be/messages/b6893a00-c6cc-11f0-adb9-f9fe7ea2ec69',
    content: {
      name: 'schedule_meeting',
      type: 'json',
      encryptionKeyUrl: 'kms://kms-cisco.wbx2.com/keys/dd6053f0-a1b3-428d-8104-317527d73630',
      parameters: {
        commentary:
          'eyJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiZGlyIn0..XF83oi9o239D4NGB.S2zhHp9cbl8A4lg-fpt8ke3SI8qoXH9t3TU.EyU2l_1s2EwYEfjxEKofNw',
      },
      value: {
        results: {
          category: 'schedule_meeting',
          data: {
            success: true,
            status: 'created',
            attendees: [
              {
                email:
                  'eyJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiZGlyIn0..f5jNAZwKeDNzDUvQ.T8w_ExM6Hm-tGS_uaSynS0CN_A.wVMQ9Or2gPenBsMrTJkc5g',
                status: 'available',
              },
              {
                email:
                  'eyJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiZGlyIn0..o11N2WbDUDUqvEnm.34WzenqMdgZVeQMNRy_DHA.hL8eYUZELMWsI4yPOw47iw',
                status: 'available',
              },
            ],
            startTime: '2025-11-26T09:00:00Z',
            duration: '1800000',
            title:
              'eyJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiZGlyIn0..hMv9vvKVdCDcTiDo.X-sdlYWHtj-XCdb-NShrifhHjZ8.vw4oTKOP2us7AifUNqmtYA',
            timeZone: 'Europe/London',
            inScopeReply:
              'eyJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiZGlyIn0..XF83oi9o239D4NGB.S2zhHp9cbl8A4lg-fpt8ke3SI8qoXH9t3TU.EyU2l_1s2EwYEfjxEKofNw',
            meetingLink:
              'eyJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiZGlyIn0..AiEkfbxIlmRv6ZPY.sZGv5x6h6-pq1zKtyfCG1M0U9fQnnwpew98TlIUMNLVDeohBan9oU6vnCIXdhZPXxtEZYObFCMig-QsggAov3dRqjKEqN37IH4g.PjZxRf-mtLd36RdrJPq5MA',
            schedulerUUID: '21e53358f00b46bda778d9e7124f6f1e',
            meetingUUID: '920eab08068b4382a31d26ddecc9ec8b',
            meetingId: '837dc916-2259-6c04-9b51-d4dcfc7c4557',
          },
        },
      },
    },
    createdAt: '2025-11-21T11:25:01.670071069Z',
    creator: {role: 'assistant'},
  },
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

  // Decrypt attendee emails
  if (data.value?.results?.data?.attendees) {
    await Promise.all(
      data.value.results.data.attendees.map((attendee, index) => {
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
  ]);
};

export const decryptMessage = async (data, webex) => {
  await decryptInPlace(data, 'value', 'encryptionKeyUrl', webex);
};

export const decryptWorkspace = async (data, webex) => {
  await decryptInPlace(data, 'value.value', 'encryptionKeyUrl', webex);
};
