/* eslint camelcase: [0] */

import ciscospark from '@ciscospark/phone';
export {default as default} from '@ciscospark/phone';
window.spark = ciscospark;

Object.assign(ciscospark.config.credentials.oauth, {
  client_id: `C36e3aaa500f04b87d80df6921119284520befe8d2ba2dac2683cf19aee18bf46`,
  client_secret: `d494094f2e03ca6bf7348b74c21cdd90cd4aa0135c227e227b5e8a602e62e42b`,
  scope: `spark:people_read spark:rooms_read spark:rooms_write spark:memberships_read spark:memberships_write spark:messages_read spark:messages_write spark:teams_read spark:teams_write`,
  redirect_uri: `http://127.0.0.1:8000`
});

if (window.location.href.includes(`4000`)) {
  Object.assign(ciscospark.config.credentials.oauth, {
    redirect_uri: `http://127.0.0.1:4000/app`
  });
}

if (window.location.href.toLowerCase().includes(`iremmel`)) {
  Object.assign(ciscospark.config.credentials.oauth, {
    redirect_uri: `https://sqbu-github.cisco.com/pages/iremmel/squared-js-sdk/app`
  });
}

if (window.location.href.toLowerCase().includes(`webexsquared`)) {
  Object.assign(ciscospark.config.credentials.oauth, {
    redirect_uri: `https://sqbu-github.cisco.com/pages/WebExSquared/squared-js-sdk/app`
  });
}
