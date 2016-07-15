/* eslint camelcase: [0] */

import ciscospark from 'ciscospark';
export {default as default} from 'ciscospark';
window.spark = ciscospark;

const l = window.location;

Object.assign(ciscospark.config.credentials.oauth, {
  client_id: `C36e3aaa500f04b87d80df6921119284520befe8d2ba2dac2683cf19aee18bf46`,
  client_secret: `d494094f2e03ca6bf7348b74c21cdd90cd4aa0135c227e227b5e8a602e62e42b`,
  scope: `spark:people_read spark:rooms_read spark:rooms_write spark:memberships_read spark:memberships_write spark:messages_read spark:messages_write spark:teams_read spark:teams_write`,
  redirect_uri: `${l.protocol}//${l.host}${l.pathname}`.replace(/\/$/, ``)
});
