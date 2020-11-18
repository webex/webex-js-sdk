
import uuid from 'uuid';
import retry from '@webex/test-helper-retry';

const CMR = {};

CMR.reserve = (webex, claimed) => {
  if (!webex) {
    return Promise.reject(new Error('webex is required'));
  }
  // If you are using https://whistler-prod.allnint.ciscospark.com/api/v1 and want CMR4, pass CMR_4
  // If you are using https://whistler-prod.allnint.ciscospark.com/api/v1 and want CMR3, pass CMR_3
  // If you are using https://whistler.allnint.ciscospark.com/api/v1 and want CMR4, pass CMR_4_INT (soon you’ll just pass CMR_4)
  // If you are using https://whistler.allnint.ciscospark.com/api/v1 and want CMR3, pass CMR_3
  const resourceType = 'CMR_4';

  console.log('RESERVING INITIATED');

  const requestBody = {
    method: 'POST',
    uri: 'https://whistler-prod.allnint.ciscospark.com/api/v1/reservations',
    headers: {
      authorization: `Bearer ${webex.credentials.supertoken.access_token}`,
      'cisco-no-http-redirect': null,
      'spark-user-agent': null,
      trackingid: `ITCLIENT_${uuid.v4()}_0_imi:true`
    },
    body: {
      resourceType,
      requestMetaData: {
        emailAddress: `test${uuid.v4()}@wx2.example.com`,
        loginType: 'loginGuest'
      },
      reservedBy: 'Webex JavaScript SDK Test Suite'
    }
  };

  if (claimed) {
    requestBody.body.requestMetaData.claimPmr = webex.internal.device.userId;
  }
  console.log('USER ID ', webex.internal.device.userId);

  return webex.request(requestBody)
    .then((response) => {
      const cmr = response.body;

      console.log('reserved cmr');
      cmr.meetingLink = `https://${cmr.responseMetaData.name}/meet/${cmr.responseMetaData.domain}`;
      cmr.sipAddress = `${cmr.responseMetaData.meetingId}@${cmr.responseMetaData.domain}`;

      return cmr;
    })
    .catch((e) => console.error('Error resorving CMR ', e));
};

CMR.release = (webex, reservationUrl) => {
  console.log('releasing cmr');

  return webex.request({
    method: 'DELETE',
    uri: reservationUrl,
    headers: {
      authorization: `Bearer ${webex.credentials.supertoken.access_token}`,
      'cisco-no-http-redirect': null,
      'spark-user-agent': null
    }
  })
    .then(() => console.log('released cmr'));
};

CMR.waitForHostToJoin = (webex, resourceUrl) => retry(() => {
  console.log('checking if the host has joined');

  return webex.request({
    method: 'GET',
    uri: resourceUrl,
    headers: {
      authorization: `Bearer ${webex.credentials.supertoken.access_token}`,
      'cisco-no-http-redirect': null,
      'spark-user-agent': null
    }
  })
    .then((res) => {
      if (res.body && res.body.meeting.hostPresent) {
        console.log('the host has joined');

        return;
      }

      console.log('the host has not joined');
      throw new Error('Meeting host has not yet joined');
    });
})
  .then(() => true)
  .catch((reason) => {
    console.warn(reason);

    return false;
  });


export default CMR;
