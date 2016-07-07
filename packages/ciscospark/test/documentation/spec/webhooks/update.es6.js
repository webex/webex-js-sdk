import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`updates a webhook`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `Webhook Example`});
  let webhook = await ciscospark.webhooks.create({
    resource: `messages`,
    event: `created`,
    filter: `roomId=${room.id}`,
    targetUrl: `https://example.com/webhook`,
    name: `Test Webhook`
  });
  webhook.targetUrl = `https://example.com/webhook/newtarget`;
  await ciscospark.webhooks.update(webhook);
  webhook = await ciscospark.webhooks.get(webhook);
  assert.equal(webhook.targetUrl, `https://example.com/webhook/newtarget`);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
