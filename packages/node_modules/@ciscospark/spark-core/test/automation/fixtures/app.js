/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser*/

import Spark from '../../..';

const spark = window.spark = new Spark();

document.body.classList.add(`ready`);

document.getElementById(`initiate-implicit-grant`).addEventListener(`click`, () => {
  spark.authenticate();
});

document.getElementById(`initiate-authorization-code-grant`).addEventListener(`click`, () => {
  spark.config.credentials.clientType = `confidential`;
  spark.authenticate();
});

document.getElementById(`token-refresh`).addEventListener(`click`, () => {
  document.getElementById(`access-token`).innerHTML = ``;
  spark.authorize({force: true})
    .then(() => {
      document.getElementById(`access-token`).innerHTML = spark.credentials.authorization.access_token;
      document.getElementById(`refresh-token`).innerHTML = spark.credentials.authorization.refresh_token;
    });
});

document.getElementById(`logout`).addEventListener(`click`, () => {
  spark.logout();
});

spark.listenToAndRun(spark, `change:isAuthenticated`, () => {
  if (!spark.isAuthenticated) {
    return;
  }

  document.getElementById(`access-token`).innerHTML = spark.credentials.authorization.access_token;
  document.getElementById(`refresh-token`).innerHTML = spark.credentials.authorization.refresh_token;

  spark.request({
    uri: `https://locus-a.wbx2.com/locus/api/v1/ping`
  })
    .then(() => {
      document.getElementById(`ping-complete`).innerHTML = `success`;
    });
});
