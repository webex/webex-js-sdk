
// Too much stuff can go wrong with CMR, so it's really helpful to log what it's
// doing
/* eslint-disable no-console */

import uuid from 'uuid';
import retry from '@ciscospark/test-helper-retry';

const cmrs = new Set();

export default class CMR {
  static reserve(spark) {
    if (!spark) {
      return Promise.reject(new Error('spark is required'));
    }

    console.log('reserving cmr');
    return spark.request({
      method: 'POST',
      uri: 'https://whistler.onint.ciscospark.com/api/v1/reservations',
      headers: {
        authorization: `Bearer ${spark.credentials.supertoken.access_token}`,
        'cisco-no-http-redirect': null,
        'spark-user-agent': null,
        trackingid: `ITCLIENT_${uuid.v4()}_0_imi:true`
      },
      body: {
        resourceType: 'CMR_3',
        requestMetaData: {
          emailAddress: `test${uuid.v4()}@wx2.example.com`,
          loginType: 'loginGuest'
        },
        reservedBy: 'Spark JavaScript SDK Test Suite'
      }
    })
      .then((res) => new CMR(spark, res.body))
      .then((cmr) => {
        console.log('reserved cmr');
        return cmr;
      });
  }

  constructor(spark, attrs) {
    Object.assign(this, attrs);
    this.spark = spark;
    this.sipAddress = `${this.responseMetaData.meetingId}@${this.responseMetaData.domain}`;
  }

  release() {
    console.log('releasing cmr');
    return this.spark.request({
      method: 'DELETE',
      uri: this.reservationUrl,
      headers: {
        authorization: `Bearer ${this.spark.credentials.supertoken.access_token}`,
        'cisco-no-http-redirect': null,
        'spark-user-agent': null
      }
    })
      .then(() => console.log('released cmr'));
  }

  waitForHostToJoin() {
    return retry(() => {
      console.log('checking if the host has joined');
      return this.spark.request({
        method: 'GET',
        uri: this.resourceUrl,
        headers: {
          authorization: `Bearer ${this.spark.credentials.supertoken.access_token}`,
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
  }
}

if (typeof after !== 'undefined') {
  after(() => Promise.all([...cmrs].map((cmr) => cmr.release()
    .catch((reason) => console.warn('failed to release CMR', reason)))));
}
