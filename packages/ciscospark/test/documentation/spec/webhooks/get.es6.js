import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`retrieves a webhook`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `Webhook Example`});
  const webhook = await ciscospark.webhooks.create({
    resource: `messages`,
    event: `created`,
    filter: `roomId=${room.id}`,
    targetUrl: `https://example.com/webhook`,
    name: `Test Webhook`
  });
  const webhook2 = await ciscospark.webhooks.get(webhook.id);
  assert.deepEqual(webhook2, webhook);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
